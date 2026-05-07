import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, Folder } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/common/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils/date'
import { requireAdminRole } from '@/lib/route-guards'

export const Route = createFileRoute('/t/$tenant_id/projects/')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: ProjectsPage,
})

const ACCENT = '#D71921'

function PendingDots({ count }: { count: number }) {
  const dots = Math.min(count, 10)
  const extra = count > 10 ? count - 10 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
      {Array.from({ length: dots }).map((_, i) => (
        <div key={i} style={{ width: 6, height: 6, background: ACCENT, flexShrink: 0 }} />
      ))}
      {extra > 0 && (
        <span className="font-mono" style={{ fontSize: 9, color: ACCENT, marginLeft: 2 }}>+{extra}</span>
      )}
    </div>
  )
}

function ProjectsPage() {
  const { tenant_id } = Route.useParams()
  const navigate = useNavigate()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects', tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('tenant_id', tenant_id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const pendingCounts = useQuery({
    queryKey: ['projects-pending-counts', tenant_id],
    queryFn: async () => {
      if (!projects?.length) return {}
      const projectIds = projects.map((p) => p.id)
      const { data } = await supabase
        .from('approval_requests')
        .select('project_id')
        .in('project_id', projectIds)
        .eq('status', 'PENDING')
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        counts[row.project_id] = (counts[row.project_id] ?? 0) + 1
      }
      return counts
    },
    enabled: !!projects?.length,
  })

  return (
    <div>
      <TopBar
        title="プロジェクト"
        actions={
          <Button onClick={() => navigate({ to: '/t/$tenant_id/projects/new', params: { tenant_id } })}>
            <Plus className="h-4 w-4 mr-1" />
            新規作成
          </Button>
        }
      />
      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            icon={<Folder />}
            title="プロジェクトがありません"
            description="AIエージェントアプリをプロジェクトとして登録してください"
            action={
              <Button onClick={() => navigate({ to: '/t/$tenant_id/projects/new', params: { tenant_id } })}>
                最初のプロジェクトを作成
              </Button>
            }
          />
        ) : (
          <div className="border-t border-[#E8E8E8]">
            {projects.map((project) => {
              const pendingCount = pendingCounts.data?.[project.id] ?? 0
              return (
                <Link
                  key={project.id}
                  to="/t/$tenant_id/projects/$project_id"
                  params={{ tenant_id, project_id: project.id }}
                  className="flex items-center gap-4 py-4 border-b border-[#E8E8E8] hover:bg-[#F0F0F0] transition-colors"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="shrink-0" style={{ width: 8, height: 8, borderRadius: '50%', background: project.is_active ? '#4A9E5C' : '#CCCCCC' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: '#1A1A1A' }}>{project.name}</p>
                    {project.description && (
                      <p className="font-mono truncate mt-0.5" style={{ fontSize: 11, color: '#999999' }}>{project.description}</p>
                    )}
                    {pendingCount > 0 && <PendingDots count={pendingCount} />}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: project.is_active ? '#4A9E5C' : '#CCCCCC' }}>
                      {project.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <span className="font-mono" style={{ fontSize: 11, color: '#CCCCCC' }}>{formatDate(project.created_at)}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
