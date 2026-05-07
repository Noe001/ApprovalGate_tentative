import { createSupabaseAdmin, extractApiKey, validateApiKey } from '../_shared/auth.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  action_name: string
  reason: string
  description?: string
  metadata?: Record<string, unknown>
  timeout_override?: number
  on_timeout?: 'deny' | 'allow'
  approver_mode?: 'any' | 'all'
}

interface RuleRow {
  id: string
  tenant_id: string
  project_id: string
  name: string
  action_type: string
  action_config: Record<string, unknown>
  timeout_seconds: number | null
  "order": number
  is_active: boolean
  rule_conditions: RuleConditionRow[]
}

const MAX_METADATA_BYTES = 10 * 1024

interface RuleConditionRow {
  id: string
  rule_id: string
  field: string
  operator: string
  value: string
  group: number
}

// ---------------------------------------------------------------------------
// Rule engine
// ---------------------------------------------------------------------------

function resolveFieldValue(
  field: string,
  body: RequestBody
): string | number | undefined {
  if (field === 'reason') return body.reason
  if (field === 'action_name') return body.action_name

  // Support nested metadata.xxx paths
  if (field.startsWith('metadata.') && body.metadata) {
    const key = field.slice('metadata.'.length)
    const val = body.metadata[key]
    if (val !== undefined && val !== null) {
      return formatValue(val)
    }
    return undefined
  }

  return undefined
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return '[unserializable]'
  }
}

function evaluateCondition(
  condition: RuleConditionRow,
  body: RequestBody
): boolean {
  const fieldValue = resolveFieldValue(condition.field, body)
  const condValue = condition.value

  if (fieldValue === undefined) return false

  const strField = String(fieldValue)
  const numField = Number.parseFloat(strField)
  const numCond = Number.parseFloat(condValue)

  switch (condition.operator) {
    case 'contains':
      return strField.includes(condValue)
    case 'not_contains':
      return !strField.includes(condValue)
    case 'equals':
      return strField === condValue
    case 'not_equals':
      return strField !== condValue
    case 'gt':
      return !Number.isNaN(numField) && !Number.isNaN(numCond) && numField > numCond
    case 'gte':
      return !Number.isNaN(numField) && !Number.isNaN(numCond) && numField >= numCond
    case 'lt':
      return !Number.isNaN(numField) && !Number.isNaN(numCond) && numField < numCond
    case 'lte':
      return !Number.isNaN(numField) && !Number.isNaN(numCond) && numField <= numCond
    default:
      return false
  }
}

function matchesRule(rule: RuleRow, body: RequestBody): boolean {
  const conditions = rule.rule_conditions
  if (!conditions || conditions.length === 0) return true

  // Group conditions by group
  const groups = new Map<number, RuleConditionRow[]>()
  for (const cond of conditions) {
    const list = groups.get(cond.group) ?? []
    list.push(cond)
    groups.set(cond.group, list)
  }

  // Groups are OR'd; within each group conditions are AND'd
  for (const [, groupConditions] of groups) {
    const groupMatch = groupConditions.every((c) => evaluateCondition(c, body))
    if (groupMatch) return true
  }
  return false
}

function findMatchingRule(
  rules: RuleRow[],
  body: RequestBody
): RuleRow | null {
  const activeRules = rules
    .filter((r) => r.is_active)
    .sort((a, b) => a["order"] - b["order"])

  for (const rule of activeRules) {
    if (matchesRule(rule, body)) return rule
  }
  return null
}

function normalizeRequestBody(input: Record<string, unknown>): RequestBody {
  const actionName = input['action_name'] ?? input['actionName']
  const timeout = input['timeout_override'] ?? input['timeoutOverride'] ?? input['timeout']
  const approverMode = input['approver_mode'] ?? input['approverMode']
  const onTimeout = input['on_timeout'] ?? input['onTimeout']

  return {
    action_name: typeof actionName === 'string' ? actionName : '',
    reason: typeof input['reason'] === 'string' ? input['reason'] : '',
    description: typeof input['description'] === 'string' ? input['description'] : undefined,
    metadata: isPlainRecord(input['metadata']) ? input['metadata'] : undefined,
    timeout_override: typeof timeout === 'number' ? timeout : undefined,
    on_timeout: onTimeout === 'allow' || onTimeout === 'deny' ? onTimeout : undefined,
    approver_mode: approverMode === 'all' || approverMode === 'any' ? approverMode : undefined,
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function metadataSizeBytes(metadata: Record<string, unknown> | undefined): number {
  if (!metadata) return 0
  return new TextEncoder().encode(JSON.stringify(metadata)).length
}

function extractAssigneeIds(config: Record<string, unknown> | undefined): string[] {
  const assigneeIds = config?.['assignee_ids'] ?? config?.['approver_ids']
  if (!Array.isArray(assigneeIds)) return []
  return assigneeIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

// ---------------------------------------------------------------------------
// Slack notification
// ---------------------------------------------------------------------------

async function sendSlackNotification(
  tenantId: string,
  requestId: string,
  actionName: string,
  reason: string,
  projectName: string,
  metadata: Record<string, unknown> | undefined
): Promise<void> {
  const supabase = createSupabaseAdmin()

  const { data: settings } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!settings) return
  if (settings.email_notifications_enabled === false) return

  const tokenOrWebhook = settings.slack_bot_token as string | null
  const slackWebhookUrl = tokenOrWebhook?.startsWith('https://hooks.slack.com/')
    ? tokenOrWebhook
    : null
  const slackBotToken = tokenOrWebhook && !slackWebhookUrl ? tokenOrWebhook : null
  if (!slackWebhookUrl && !slackBotToken) return

  const metadataSummary =
    metadata && Object.keys(metadata).length > 0
      ? Object.entries(metadata)
          .map(([k, v]) => `• ${k}: ${formatValue(v)}`)
          .join('\n')
      : 'なし'

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `⏳ 承認リクエスト: ${actionName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*プロジェクト:*\n${projectName}`,
        },
        {
          type: 'mrkdwn',
          text: `*リクエストID:*\n${requestId}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*理由:*\n${reason}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*メタデータ:*\n${metadataSummary}`,
      },
    },
    {
      type: 'actions',
      block_id: `approval_actions_${requestId}`,
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ 承認', emoji: true },
          style: 'primary',
          value: 'approve',
          action_id: `approve_${requestId}`,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '❌ 拒否', emoji: true },
          style: 'danger',
          value: 'reject',
          action_id: `reject_${requestId}`,
        },
      ],
    },
  ]

  const payload = {
    text: `承認リクエスト: ${actionName}`,
    blocks,
  }

  if (slackWebhookUrl) {
    await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  } else if (slackBotToken && settings.slack_channel_id) {
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${slackBotToken}`,
      },
      body: JSON.stringify({ channel: settings.slack_channel_id, ...payload }),
    }).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // 1. Extract and validate API key
    const rawKey = extractApiKey(req)
    const supabase = createSupabaseAdmin()
    const { apiKey, project, tenant } = await validateApiKey(rawKey, supabase)

    // 2. Parse and validate request body
    let body: RequestBody
    try {
      const rawBody = await req.json()
      body = normalizeRequestBody(rawBody as Record<string, unknown>)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!body.action_name || typeof body.action_name !== 'string') {
      return new Response(
        JSON.stringify({ error: 'action_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (!body.reason || typeof body.reason !== 'string') {
      return new Response(
        JSON.stringify({ error: 'reason is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (metadataSizeBytes(body.metadata) > MAX_METADATA_BYTES) {
      return new Response(
        JSON.stringify({ error: 'metadata must be 10KB or smaller' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Fetch rules with conditions for the project
    const { data: rules, error: rulesError } = await supabase
      .from('rules')
      .select('*, rule_conditions(*)')
      .eq('project_id', project.id)
      .eq('tenant_id', tenant.id)
      .order('order', { ascending: true })

    if (rulesError) {
      console.error('Error fetching rules:', rulesError)
    }

    // 4. Evaluate rules
    const matchedRule = findMatchingRule((rules ?? []) as RuleRow[], body)

    let status: string
    let assigneeIds: string[] | null = null
    let configError: string | null = null

    if (matchedRule) {
      switch (matchedRule.action_type) {
        case 'auto_approve':
          status = 'AUTO_APPROVED'
          break
        case 'auto_reject':
          status = 'REJECTED'
          break
        case 'escalate':
        case 'notify_approver':
          status = 'PENDING'
          assigneeIds = extractAssigneeIds(matchedRule.action_config)
          if (assigneeIds.length === 0) assigneeIds = project.default_approver_ids ?? []
          break
        default:
          status = 'PENDING'
          assigneeIds = project.default_approver_ids ?? []
          break
      }
    } else {
      status = 'PENDING'
      assigneeIds = project.default_approver_ids ?? []
    }

    if (status === 'PENDING' && (!assigneeIds || assigneeIds.length === 0)) {
      status = 'ERROR'
      configError = 'No approver is configured for this project or matching rule'
    }

    // 5. Calculate timeout_at
    const timeoutSeconds =
      body.timeout_override ??
      matchedRule?.timeout_seconds ??
      project.timeout_seconds ??
      tenant.default_timeout_seconds ??
      1800

    const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000).toISOString()

    // 6. Insert approval_request
    const requestId = crypto.randomUUID()
    const now = new Date().toISOString()

    const { error: insertError } = await supabase.from('approval_requests').insert({
      id: requestId,
      project_id: project.id,
      tenant_id: tenant.id,
      status,
      action_name: body.action_name,
      reason: body.reason,
      description: body.description ?? null,
      metadata: body.metadata ?? null,
      assignee_ids: assigneeIds ?? [],
      approver_mode: body.approver_mode ?? project.approver_mode ?? 'any',
      decided_by_id: null,
      rejection_reason: configError,
      applied_rule_id: matchedRule?.id ?? null,
      decided_at: null,
      timeout_at: timeoutAt,
      is_test: apiKey.is_test,
      created_at: now,
    })

    if (insertError) {
      console.error('Error inserting approval_request:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create approval request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 7. Insert audit log
    await supabase.from('audit_logs').insert({
      id: crypto.randomUUID(),
      tenant_id: tenant.id,
      actor_id: null,
      actor_type: 'system',
      action: 'submit',
      resource_type: 'approval_request',
      resource_id: requestId,
      channel: 'api',
      after_data: {
        action_name: body.action_name,
        project_id: project.id,
        status,
        rule_matched: matchedRule?.id ?? null,
        error: configError,
      },
      created_at: now,
    })

    // 8. Send Slack notification for PENDING requests
    if (status === 'PENDING' && !apiKey.is_test) {
      await sendSlackNotification(
        tenant.id,
        requestId,
        body.action_name,
        body.reason,
        project.name,
        body.metadata
      )
    }

    // 9. Return response
    let message = '承認待ちです'
    if (status === 'AUTO_APPROVED') message = '自動承認されました'
    if (status === 'REJECTED') message = '自動拒否されました'
    if (status === 'ERROR') message = '承認者が設定されていないため処理できません'

    if (status === 'ERROR') {
      return new Response(
        JSON.stringify({
          error: message,
          request_id: requestId,
          data: { request_id: requestId, status, timeout_at: timeoutAt },
        }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        id: requestId,
        status,
        message,
        timeout_at: timeoutAt,
        data: { request_id: requestId, status, timeout_at: timeoutAt },
      }),
      {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    const error = err as Error & { status?: number }
    const status = error.status ?? 500
    const message = error.message ?? 'Internal server error'
    console.error('sdk-requests error:', error)
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
