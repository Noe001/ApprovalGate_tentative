import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    const { data: membership } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', session.user.id)
      .limit(1)
      .maybeSingle()
    if (membership) {
      throw redirect({ to: '/t/$tenant_id/dashboard', params: { tenant_id: membership.tenant_id } })
    }
    throw redirect({ to: '/create-team' })
  },
  component: () => null,
})
