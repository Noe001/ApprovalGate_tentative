import { createSupabaseAdmin, extractApiKey, validateApiKey } from '../_shared/auth.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    // 1. Extract and validate API key
    const rawKey = extractApiKey(req)
    const supabase = createSupabaseAdmin()
    const { project } = await validateApiKey(rawKey, supabase)

    // 2. Extract request ID from URL path
    // Expected path: /sdk/v1/requests/:id/status
    // In Supabase Edge Functions the URL is the full request URL
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)

    // Find the 'requests' segment and take the next part as id
    const requestsIndex = pathParts.lastIndexOf('requests')
    const requestId =
      requestsIndex === -1 ? null : pathParts[requestsIndex + 1]

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: 'Request ID is required in path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Fetch approval_request by ID
    const { data: approvalRequest, error: fetchError } = await supabase
      .from('approval_requests')
      .select(
        'id, project_id, tenant_id, status, decided_by_id, rejection_reason, decided_at, created_at, timeout_at'
      )
      .eq('id', requestId)
      .single()

    if (fetchError || !approvalRequest) {
      return new Response(
        JSON.stringify({ error: 'Approval request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Verify the request belongs to the same project as the API key
    if (approvalRequest.project_id !== project.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied: request belongs to a different project' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. Return status
    return new Response(
      JSON.stringify({
        id: approvalRequest.id,
        status: approvalRequest.status,
        decided_by_id: approvalRequest.decided_by_id,
        rejection_reason: approvalRequest.rejection_reason,
        decided_at: approvalRequest.decided_at,
        created_at: approvalRequest.created_at,
        timeout_at: approvalRequest.timeout_at,
        data: {
          request_id: approvalRequest.id,
          status: approvalRequest.status,
          decided_at: approvalRequest.decided_at,
          decided_by: approvalRequest.decided_by_id,
          rejection_reason: approvalRequest.rejection_reason,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    const error = err as Error & { status?: number }
    const status = error.status ?? 500
    const message = error.message ?? 'Internal server error'
    console.error('sdk-status error:', error)
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
