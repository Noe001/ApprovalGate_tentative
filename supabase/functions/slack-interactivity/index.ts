import { createSupabaseAdmin } from '../_shared/auth.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

// ---------------------------------------------------------------------------
// Slack signature verification
// ---------------------------------------------------------------------------

async function verifySlackSignature(
  req: Request,
  rawBody: string
): Promise<boolean> {
  const signingSecret = Deno.env.get('SLACK_SIGNING_SECRET')
  if (!signingSecret) {
    console.error('SLACK_SIGNING_SECRET not configured')
    return false
  }

  const timestamp = req.headers.get('x-slack-request-timestamp')
  const slackSignature = req.headers.get('x-slack-signature')

  if (!timestamp || !slackSignature) return false

  // Reject if timestamp is older than 5 minutes (300 seconds)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    console.warn('Slack request timestamp too old')
    return false
  }

  const baseString = `v0:${timestamp}:${rawBody}`
  const encoder = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(baseString)
  )

  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const computedSignature = `v0=${computedHex}`

  // Constant-time comparison to prevent timing attacks
  if (computedSignature.length !== slackSignature.length) return false

  let match = true
  for (let i = 0; i < computedSignature.length; i++) {
    if (computedSignature.charCodeAt(i) !== slackSignature.charCodeAt(i)) {
      match = false
    }
  }
  return match
}

// ---------------------------------------------------------------------------
// Update original Slack message via response_url
// ---------------------------------------------------------------------------

async function updateSlackMessage(
  responseUrl: string,
  text: string,
  decidedBy: string
): Promise<void> {
  const payload = {
    replace_original: true,
    text: `${text} (by <@${decidedBy}>)`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${text} (by <@${decidedBy}>)`,
        },
      },
    ],
  }

  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.error('Failed to update Slack message:', err))
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

  // Read raw body for signature verification (must be done before any parsing)
  const rawBody = await req.text()

  // 1. Verify Slack signature
  const isValid = await verifySlackSignature(req, rawBody)
  if (!isValid) {
    return new Response(JSON.stringify({ error: 'Invalid Slack signature' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // 2. Parse URL-encoded payload
    const params = new URLSearchParams(rawBody)
    const payloadStr = params.get('payload')

    if (!payloadStr) {
      return new Response(JSON.stringify({ error: 'Missing payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(payloadStr)
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid payload JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Extract action details
    const actions = payload.actions as Array<Record<string, unknown>> | undefined
    if (!actions || actions.length === 0) {
      // Not an action payload we care about
      return new Response('ok', { status: 200 })
    }

    const action = actions[0]
    const actionId = action.action_id as string | undefined
    const responseUrl = payload.response_url as string | undefined
    const slackUser = payload.user as Record<string, string> | undefined
    const slackUserId = slackUser?.id ?? 'unknown'

    if (!actionId) {
      return new Response('ok', { status: 200 })
    }

    // 4. Parse action: approve_{requestId} or reject_{requestId}
    const approveMatch = actionId.match(/^approve_(.+)$/)
    const rejectMatch = actionId.match(/^reject_(.+)$/)

    if (!approveMatch && !rejectMatch) {
      console.log('Unrecognized action_id:', actionId)
      return new Response('ok', { status: 200 })
    }

    const requestId = approveMatch ? approveMatch[1] : rejectMatch![1]
    const isApprove = !!approveMatch

    const supabase = createSupabaseAdmin()

    // 5. Find approval_request and verify it's still PENDING
    const { data: approvalRequest, error: fetchError } = await supabase
      .from('approval_requests')
      .select('id, status, tenant_id, action_name')
      .eq('id', requestId)
      .single()

    if (fetchError || !approvalRequest) {
      if (responseUrl) {
        await updateSlackMessage(responseUrl, '❌ リクエストが見つかりません', slackUserId)
      }
      return new Response('ok', { status: 200 })
    }

    if (approvalRequest.status !== 'PENDING') {
      const statusMsg =
        approvalRequest.status === 'APPROVED' || approvalRequest.status === 'AUTO_APPROVED'
          ? '✅ このリクエストはすでに承認されています'
          : '❌ このリクエストはすでに処理されています'
      if (responseUrl) {
        await updateSlackMessage(responseUrl, statusMsg, slackUserId)
      }
      return new Response('ok', { status: 200 })
    }

    const now = new Date().toISOString()

    if (isApprove) {
      // 6a. Approve
      const { error: updateError } = await supabase
        .from('approval_requests')
        .update({
          status: 'APPROVED',
          decided_by_id: slackUserId,
          decided_at: now,
        })
        .eq('id', requestId)
        .eq('status', 'PENDING') // optimistic concurrency guard

      if (updateError) {
        console.error('Error updating approval_request:', updateError)
        return new Response('ok', { status: 200 })
      }

      await supabase.from('audit_logs').insert({
        id: crypto.randomUUID(),
        tenant_id: approvalRequest.tenant_id,
        actor_id: null,
        actor_type: 'user',
        action: 'approve',
        resource_type: 'approval_request',
        resource_id: requestId,
        channel: 'slack',
        after_data: {
          action_name: approvalRequest.action_name,
          slack_user_id: slackUserId,
        },
        created_at: now,
      })

      if (responseUrl) {
        await updateSlackMessage(
          responseUrl,
          `✅ 承認されました: ${approvalRequest.action_name}`,
          slackUserId
        )
      }
    } else {
      // 6b. Reject (immediately with generic reason)
      const rejectionReason = 'Rejected via Slack'

      const { error: updateError } = await supabase
        .from('approval_requests')
        .update({
          status: 'REJECTED',
          decided_by_id: slackUserId,
          rejection_reason: rejectionReason,
          decided_at: now,
        })
        .eq('id', requestId)
        .eq('status', 'PENDING') // optimistic concurrency guard

      if (updateError) {
        console.error('Error updating approval_request:', updateError)
        return new Response('ok', { status: 200 })
      }

      await supabase.from('audit_logs').insert({
        id: crypto.randomUUID(),
        tenant_id: approvalRequest.tenant_id,
        actor_id: null,
        actor_type: 'user',
        action: 'reject',
        resource_type: 'approval_request',
        resource_id: requestId,
        channel: 'slack',
        after_data: {
          action_name: approvalRequest.action_name,
          slack_user_id: slackUserId,
          reason: rejectionReason,
        },
        created_at: now,
      })

      if (responseUrl) {
        await updateSlackMessage(
          responseUrl,
          `❌ 拒否されました: ${approvalRequest.action_name}`,
          slackUserId
        )
      }
    }

    // 7. Return 200 to Slack immediately
    return new Response('ok', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  } catch (err: unknown) {
    const error = err as Error
    console.error('slack-interactivity error:', error)
    // Always return 200 to Slack to prevent retries
    return new Response('ok', { status: 200 })
  }
})
