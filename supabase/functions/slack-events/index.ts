import { corsHeaders, handleCors } from '../_shared/cors.ts'

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
    const body = await req.json()

    // Handle Slack URL verification challenge
    if (body.type === 'url_verification') {
      return new Response(
        JSON.stringify({ challenge: body.challenge }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Log the event type for observability
    console.log('Slack event received:', JSON.stringify({
      type: body.type,
      event_type: body.event?.type,
      team_id: body.team_id,
      event_id: body.event_id,
      event_time: body.event_time,
    }))

    // Future: handle specific event types here
    // e.g., app_mention, message, reaction_added, etc.
    //
    // Example:
    // if (body.event?.type === 'app_mention') {
    //   await handleAppMention(body.event)
    // }

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    const error = err as Error
    console.error('slack-events error:', error)
    // Return 200 to prevent Slack from retrying
    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
