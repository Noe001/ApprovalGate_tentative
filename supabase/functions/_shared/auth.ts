import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ApiKeyRow {
  id: string
  project_id: string
  key_hash: string
  key_prefix: string
  name: string
  is_test: boolean
  revoked_at: string | null
  last_used_at: string | null
}

export interface ProjectRow {
  id: string
  tenant_id: string
  name: string
  description: string | null
  default_approver_ids: string[]
  approver_mode: string
  timeout_seconds: number | null
  timeout_behavior: string | null
  is_active: boolean
}

export interface TenantRow {
  id: string
  name: string
  plan: string
  timezone: string
  default_timeout_seconds: number | null
  default_timeout_behavior: string | null
  fail_closed: boolean | null
}

export function extractApiKey(req: Request): string | null {
  const authorization = req.headers.get('authorization')
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization)
    if (match?.[1]) return match[1].trim()
  }
  return req.headers.get('x-api-key')
}

export interface ValidatedAuth {
  apiKey: ApiKeyRow
  project: ProjectRow
  tenant: TenantRow
}

export function createSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

async function hashApiKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(rawKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function validateApiKey(
  rawKey: string | null,
  supabase?: SupabaseClient
): Promise<ValidatedAuth> {
  if (!rawKey) {
    throw Object.assign(new Error('Missing API key'), { status: 401 })
  }

  // Accept rg_live_XXX or rg_test_XXX format
  if (!rawKey.startsWith('rg_live_') && !rawKey.startsWith('rg_test_')) {
    throw Object.assign(new Error('Invalid API key format'), { status: 401 })
  }

  const client = supabase ?? createSupabaseAdmin()
  const keyHash = await hashApiKey(rawKey)

  const { data: apiKeyRow, error: keyError } = await client
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .single()

  if (keyError || !apiKeyRow) {
    throw Object.assign(new Error('Invalid API key'), { status: 401 })
  }

  if (apiKeyRow.revoked_at) {
    throw Object.assign(new Error('API key has been revoked'), { status: 401 })
  }

  // Update last_used_at asynchronously (fire-and-forget)
  void Promise.resolve(
    client
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyRow.id)
  ).catch(() => {})

  // Fetch associated project
  const { data: project, error: projectError } = await client
    .from('projects')
    .select('*')
    .eq('id', apiKeyRow.project_id)
    .single()

  if (projectError || !project) {
    throw Object.assign(new Error('Associated project not found'), { status: 403 })
  }

  if (!project.is_active) {
    throw Object.assign(new Error('Project is inactive'), { status: 403 })
  }

  // Fetch associated tenant
  const { data: tenant, error: tenantError } = await client
    .from('tenants')
    .select('*')
    .eq('id', project.tenant_id)
    .single()

  if (tenantError || !tenant) {
    throw Object.assign(new Error('Associated tenant not found'), { status: 403 })
  }

  return { apiKey: apiKeyRow, project, tenant }
}
