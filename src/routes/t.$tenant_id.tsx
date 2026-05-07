import { createFileRoute, Outlet, redirect, notFound } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { useQuery } from '@tanstack/react-query'
import { useRealtimeApprovals } from '@/hooks/use-realtime-approval'
import type { UserRole } from '@/types/enums'

export const Route = createFileRoute('/t/$tenant_id')({
  beforeLoad: async ({ params }) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }

    const { data: membership } = await supabase
      .from('tenant_members')
      .select('role, tenants(name)')
      .eq('tenant_id', params.tenant_id)
      .eq('user_id', session.user.id)
      .single()

    if (!membership) {
      throw notFound()
    }

    return {
      role: membership.role as UserRole,
      tenantName: (membership.tenants as unknown as { name: string })?.name ?? '',
    }
  },
  component: TenantLayout,
})

function TenantLayout() {
  const { tenant_id } = Route.useParams()
  const { role, tenantName } = Route.useRouteContext()

  const { data: pendingData } = useQuery({
    queryKey: ['pending-count', tenant_id],
    queryFn: async () => {
      const { count } = await supabase
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .in('project_id', (
          await supabase.from('projects').select('id').eq('tenant_id', tenant_id)
        ).data?.map(p => p.id) ?? [])
      return count ?? 0
    },
    refetchInterval: 30_000,
  })

  useRealtimeApprovals(tenant_id)

  const pendingCount = pendingData ?? 0

  return (
    <div className="min-h-screen" style={{ background: '#F8F8F8' }}>
      <Sidebar
        tenantId={tenant_id}
        tenantName={tenantName}
        role={role}
        pendingCount={pendingCount}
      />
      <div className="lg:pl-64">
        <main className="pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>
      <BottomNav tenantId={tenant_id} role={role} pendingCount={pendingCount} />
    </div>
  )
}
