import { createSupabaseAdmin } from '../_shared/auth.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalRequestRow {
  id: string
  project_id: string
  tenant_id: string
  status: string
  action_name: string
  timeout_at: string
  projects: {
    timeout_seconds: number | null
    timeout_behavior: string | null
    tenant_id: string
    tenants: {
      default_timeout_behavior: string | null
      fail_closed: boolean | null
    }
  } | null
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Allow both POST (manual trigger) and GET (health check / cron ping)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createSupabaseAdmin()
    const now = new Date().toISOString()

    // 1. Find all PENDING requests that have passed their timeout_at
    const { data: timedOutRequests, error: fetchError } = await supabase
      .from('approval_requests')
      .select(`
        id,
        project_id,
        tenant_id,
        status,
        action_name,
        timeout_at,
        projects (
          timeout_seconds,
          timeout_behavior,
          tenant_id,
          tenants (
            default_timeout_behavior,
            fail_closed
          )
        )
      `)
      .eq('status', 'PENDING')
      .lte('timeout_at', now)

    if (fetchError) {
      console.error('Error fetching timed-out requests:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch timed-out requests' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!timedOutRequests || timedOutRequests.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No timed-out requests found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let processedCount = 0
    const errors: string[] = []

    // 2. Process each timed-out request
    for (const request of (timedOutRequests as unknown) as ApprovalRequestRow[]) {
      try {
        // Determine timeout behavior from project, then tenant
        const project = request.projects
        const tenant = project?.tenants

        // Priority: project.timeout_behavior -> tenant.default_timeout_behavior -> tenant.fail_behavior -> 'deny'
        const timeoutBehavior =
          project?.timeout_behavior ??
          tenant?.default_timeout_behavior ??
          (tenant?.fail_closed === false ? 'allow' : 'deny')

        // Map behavior to status
        let newStatus: string
        if (timeoutBehavior === 'allow' || timeoutBehavior === 'fail_open') {
          // fail_open: auto-approve on timeout
          newStatus = 'AUTO_APPROVED'
        } else {
          // fail_closed / deny: mark as TIMED_OUT
          newStatus = 'TIMED_OUT'
        }

        const updatedAt = new Date().toISOString()

        // Update the request status (use optimistic concurrency guard)
        const { error: updateError } = await supabase
          .from('approval_requests')
          .update({
            status: newStatus,
            decided_at: updatedAt,
            rejection_reason: `Request timed out (behavior: ${timeoutBehavior})`,
          })
          .eq('id', request.id)
          .eq('status', 'PENDING') // guard: only update if still PENDING

        if (updateError) {
          console.error(`Error updating request ${request.id}:`, updateError)
          errors.push(request.id)
          continue
        }

        // Insert audit log
        await supabase.from('audit_logs').insert({
          id: crypto.randomUUID(),
          tenant_id: request.tenant_id,
          actor_id: null,
          actor_type: 'system',
          action: 'timeout',
          resource_type: 'approval_request',
          resource_id: request.id,
          channel: 'system',
          after_data: {
            action_name: request.action_name,
            timeout_at: request.timeout_at,
            timeout_behavior: timeoutBehavior,
            new_status: newStatus,
          },
          created_at: updatedAt,
        })

        processedCount++
        console.log(
          `Processed timeout for request ${request.id}: ${request.action_name} -> ${newStatus}`
        )
      } catch (requestErr) {
        console.error(`Error processing request ${request.id}:`, requestErr)
        errors.push(request.id)
      }
    }

    return new Response(
      JSON.stringify({
        processed: processedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Processed ${processedCount} timed-out request(s)`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    const error = err as Error
    console.error('process-timeouts error:', error)
    return new Response(
      JSON.stringify({ error: error.message ?? 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
