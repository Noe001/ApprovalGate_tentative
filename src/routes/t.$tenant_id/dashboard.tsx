import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/common/StatusBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { TimeoutBar } from '@/components/common/TimeoutBar'
import { TopBar } from '@/components/layout/TopBar'
import { formatRelative, formatTimeout } from '@/lib/utils/date'

export const Route = createFileRoute('/t/$tenant_id/dashboard')({
  component: DashboardPage,
})

const ACCENT = '#D71921'
const SUCCESS = '#4A9E5C'
const WARNING = '#D4A843'

function getStatusColor(pct: number): string {
  if (pct >= 70) return SUCCESS
  if (pct >= 40) return WARNING
  return ACCENT
}

function ArcGauge({ pct, size = 72, color }: { pct: number; size?: number; color?: string }) {
  const cx = size / 2
  const r = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const filled = circ * Math.min(pct / 100, 1)
  const gap = Math.max(0, circ - filled)
  const strokeColor = color ?? getStatusColor(pct)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#CCCCCC" strokeWidth={4} />
        {pct > 0 && (
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={strokeColor} strokeWidth={4}
            strokeDasharray={`${filled} ${gap}`}
            transform={`rotate(-90 ${cx} ${cx})`}
            strokeLinecap="square" />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span className="font-mono" style={{ fontSize: size < 60 ? 11 : 14, color: '#000000', lineHeight: 1 }}>{pct}</span>
        <span className="font-mono" style={{ fontSize: 8, color: '#999999', marginTop: 1 }}>%</span>
      </div>
    </div>
  )
}


function DashboardPage() {
  const { tenant_id } = Route.useParams()

  const { data: stats } = useQuery({
    queryKey: ['dashboard', tenant_id],
    queryFn: async () => {
      const projectIds = (
        await supabase.from('projects').select('id').eq('tenant_id', tenant_id).eq('is_active', true)
      ).data?.map(p => p.id) ?? []

      if (projectIds.length === 0) return { pending: 0, todayTotal: 0, autoRate: 0, avgResponseMin: 0 }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [pendingRes, todayRes, autoRes, decidedRes] = await Promise.all([
        supabase.from('approval_requests').select('id', { count: 'exact', head: true })
          .in('project_id', projectIds).eq('status', 'PENDING'),
        supabase.from('approval_requests').select('id', { count: 'exact', head: true })
          .in('project_id', projectIds).gte('created_at', today.toISOString()),
        supabase.from('approval_requests').select('id', { count: 'exact', head: true })
          .in('project_id', projectIds).eq('status', 'AUTO_APPROVED')
          .gte('created_at', today.toISOString()),
        supabase.from('approval_requests').select('created_at, decided_at')
          .in('project_id', projectIds)
          .in('status', ['APPROVED', 'REJECTED'])
          .not('decided_at', 'is', null)
          .gte('created_at', today.toISOString()),
      ])

      const total = todayRes.count ?? 0
      const auto = autoRes.count ?? 0
      const autoRate = total > 0 ? Math.round((auto / total) * 100) : 0

      const decidedRows = decidedRes.data ?? []
      const avgResponseMin = decidedRows.length > 0
        ? Math.round(
            decidedRows.reduce((acc, r) => {
              return acc + (new Date(r.decided_at!).getTime() - new Date(r.created_at).getTime())
            }, 0) / decidedRows.length / 60000
          )
        : 0

      return {
        pending: pendingRes.count ?? 0,
        todayTotal: total,
        autoRate,
        avgResponseMin,
      }
    },
    refetchInterval: 30_000,
  })

  const { data: recentPending } = useQuery({
    queryKey: ['dashboard-pending', tenant_id],
    queryFn: async () => {
      const projectIds = (
        await supabase.from('projects').select('id').eq('tenant_id', tenant_id)
      ).data?.map(p => p.id) ?? []

      if (projectIds.length === 0) return []

      const { data } = await supabase
        .from('approval_requests')
        .select('id, reason, status, timeout_at, created_at, project_id, projects(name)')
        .in('project_id', projectIds)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(5)

      return data ?? []
    },
    refetchInterval: 30_000,
  })

  const pendingCount = stats?.pending ?? 0
  const autoRate = stats?.autoRate ?? 0

  return (
    <div style={{ background: '#F5F5F5', minHeight: '100vh' }}>
      <TopBar title="ダッシュボード" />

      <div style={{ padding: '0 24px 48px' }}>
        {/* Hero pending count */}
        <div style={{ paddingTop: 64, paddingBottom: 48 }}>
          <span
            className="font-mono uppercase"
            style={{ fontSize: 11, color: '#999999', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}
          >
            PENDING REQUESTS
          </span>
          <div
            className="font-display"
            style={{
              fontSize: 72,
              lineHeight: 1,
              color: pendingCount > 0 ? ACCENT : '#000000',
              marginBottom: 8,
            }}
          >
            {pendingCount}
          </div>
          <span
            className="font-mono uppercase"
            style={{ fontSize: 11, color: '#999999', letterSpacing: '0.08em' }}
          >
            {pendingCount > 0 ? 'REQUIRES YOUR ATTENTION' : 'ALL CLEAR'}
          </span>
        </div>

        {/* Secondary KPI stats */}
        <div
          style={{
            display: 'flex',
            borderTop: '1px solid #E8E8E8',
            borderBottom: '1px solid #E8E8E8',
            marginBottom: 48,
          }}
        >
          {/* TODAY'S REQUESTS */}
          <div style={{ flex: 1, padding: '20px 24px', borderRight: '1px solid #E8E8E8' }}>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, color: '#AAAAAA', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}
            >
              TODAY'S REQUESTS
            </span>
            <span className="font-mono" style={{ fontSize: 28, color: '#1A1A1A', lineHeight: 1, fontWeight: 400 }}>
              {stats?.todayTotal ?? 0}
            </span>
          </div>

          {/* AUTO-APPROVAL RATE — arc gauge */}
          <div style={{ flex: 1, padding: '20px 24px', borderRight: '1px solid #E8E8E8' }}>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, color: '#AAAAAA', letterSpacing: '0.08em', display: 'block', marginBottom: 12 }}
            >
              AUTO-APPROVAL RATE
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ArcGauge pct={autoRate} size={72} color={getStatusColor(autoRate)} />
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                  <span className="font-mono" style={{ fontSize: 28, color: '#1A1A1A', lineHeight: 1, fontWeight: 400 }}>
                    {autoRate}
                  </span>
                  <span className="font-mono" style={{ fontSize: 10, color: '#AAAAAA', letterSpacing: '0.06em' }}>%</span>
                </div>
                <span style={{ fontSize: 11, color: '#CCCCCC', marginTop: 2, display: 'block' }}>自動処理済み</span>
              </div>
            </div>
          </div>

          {/* AVG RESPONSE TIME */}
          <div style={{ flex: 1, padding: '20px 24px' }}>
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, color: '#AAAAAA', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}
            >
              AVG RESPONSE TIME
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span className="font-mono" style={{ fontSize: 28, color: '#1A1A1A', lineHeight: 1, fontWeight: 400 }}>
                {stats?.avgResponseMin ?? 0}
              </span>
              <span className="font-mono" style={{ fontSize: 10, color: '#AAAAAA', letterSpacing: '0.06em' }}>MIN</span>
            </div>
          </div>
        </div>

        {/* Pending requests table */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 12,
              borderBottom: '1px solid #E8E8E8',
              marginBottom: 0,
            }}
          >
            <span
              className="font-mono uppercase"
              style={{ fontSize: 11, color: '#999999', letterSpacing: '0.08em' }}
            >
              PENDING REQUESTS
            </span>
            <Link
              to="/t/$tenant_id/approvals"
              params={{ tenant_id }}
              className="font-mono uppercase"
              style={{ fontSize: 11, color: '#007AFF', letterSpacing: '0.06em' }}
            >
              VIEW ALL →
            </Link>
          </div>

          {!recentPending || recentPending.length === 0 ? (
            <EmptyState
              title="承認待ちのリクエストはありません"
              description="AIエージェントからリクエストが届くとここに表示されます"
            />
          ) : (
            <div>
              {recentPending.map((req) => (
                <Link
                  key={req.id}
                  to="/t/$tenant_id/approvals/$request_id"
                  params={{ tenant_id, request_id: req.id }}
                  className="flex items-center gap-4 transition-colors"
                  style={{
                    padding: '16px 0',
                    borderBottom: '1px solid #E8E8E8',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#F0F0F0' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      className="font-sans"
                      style={{
                        fontSize: 14,
                        color: '#1A1A1A',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        margin: 0,
                        marginBottom: 4,
                      }}
                    >
                      {req.reason}
                    </p>
                    <p
                      className="font-mono"
                      style={{ fontSize: 11, color: '#999999', margin: 0, letterSpacing: '0.04em' }}
                    >
                      {(req.projects as unknown as { name: string })?.name} · {formatRelative(req.created_at)}
                    </p>
                    <TimeoutBar timeoutAt={req.timeout_at} createdAt={req.created_at} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <span
                      className="font-mono"
                      style={{ fontSize: 12, color: '#D4A843', letterSpacing: '0.04em' }}
                    >
                      {formatTimeout(req.timeout_at)}
                    </span>
                    <StatusBadge status={req.status as 'PENDING'} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
