import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { subDays, parseISO } from 'date-fns'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { RequestsChart } from '@/components/analytics/RequestsChart'
import { ApproverTable } from '@/components/analytics/ApproverTable'
import { requireAnalyticsRole } from '@/lib/route-guards'
import type { UserRole } from '@/types/enums'

export const Route = createFileRoute('/t/$tenant_id/analytics')({
  beforeLoad: ({ context }) => requireAnalyticsRole(context.role),
  component: AnalyticsPage,
})

const SUCCESS = '#4A9E5C'
const WARNING = '#D4A843'
const ACCENT = '#D71921'

function getStatusColor(pct: number): string {
  if (pct >= 70) return SUCCESS
  if (pct >= 40) return WARNING
  return ACCENT
}

function SegBar({ pct, n = 20, color }: { pct: number; n?: number; color?: string }) {
  const filled = Math.round((Math.min(Math.max(pct, 0), 100) / 100) * n)
  const barColor = color ?? getStatusColor(pct)
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 4, background: i < filled ? barColor : '#E8E8E8' }} />
      ))}
    </div>
  )
}

type Period = '7' | '30' | '90'

function AnalyticsPage() {
  const { tenant_id } = Route.useParams()
  const { role } = Route.useRouteContext() as { role: UserRole }
  const canExport = role === 'owner' || role === 'admin'

  const [period, setPeriod] = useState<Period>('30')
  const days = parseInt(period, 10)

  const { data: kpi, isLoading: kpiLoading } = useQuery({
    queryKey: ['analytics-kpi', tenant_id, days],
    queryFn: async () => {
      const since = subDays(new Date(), days).toISOString()

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id')
        .eq('tenant_id', tenant_id)
        .is('deleted_at', null)

      const projectIds = projectsData?.map((p) => p.id) ?? []
      if (projectIds.length === 0) {
        return { total: 0, approvalRate: 0, avgResponseSeconds: 0, autoRate: 0 }
      }

      const { data: requests } = await supabase
        .from('approval_requests')
        .select('id, status, created_at, decided_at')
        .in('project_id', projectIds)
        .gte('created_at', since)

      if (!requests || requests.length === 0) {
        return { total: 0, approvalRate: 0, avgResponseSeconds: 0, autoRate: 0 }
      }

      const total = requests.length
      const approved = requests.filter((r) => r.status === 'APPROVED').length
      const autoApproved = requests.filter((r) => r.status === 'AUTO_APPROVED').length
      const approvalRate = total > 0 ? Math.round(((approved + autoApproved) / total) * 100) : 0
      const autoRate = total > 0 ? Math.round((autoApproved / total) * 100) : 0

      const decided = requests.filter(
        (r) =>
          (r.status === 'APPROVED' || r.status === 'REJECTED') &&
          r.decided_at !== null
      )
      const avgResponseSeconds =
        decided.length > 0
          ? Math.round(
              decided.reduce((acc, r) => {
                return acc + (parseISO(r.decided_at!).getTime() - parseISO(r.created_at).getTime()) / 1000
              }, 0) / decided.length
            )
          : 0

      return { total, approvalRate, avgResponseSeconds, autoRate }
    },
  })

  function handleExportCsv() {
    const since = subDays(new Date(), days).toISOString()

    supabase
      .from('audit_logs')
      .select('id, tenant_id, actor_id, actor_type, action, resource_type, resource_id, channel, created_at')
      .eq('tenant_id', tenant_id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return
        const headers = [
          'id',
          'tenant_id',
          'actor_id',
          'actor_type',
          'action',
          'resource_type',
          'resource_id',
          'channel',
          'created_at',
        ]
        const csvRows = [
          headers.join(','),
          ...data.map((row) =>
            headers
              .map((h) => {
                const val = row[h as keyof typeof row] ?? ''
                const str = String(val)
                return str.includes(',') || str.includes('"') || str.includes('\n')
                  ? `"${str.replace(/"/g, '""')}"`
                  : str
              })
              .join(',')
          ),
        ]
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit_logs_${tenant_id}_${period}d.csv`
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  function formatSeconds(s: number): string {
    if (s < 60) return `${s}秒`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}分`
    const h = Math.floor(m / 60)
    return `${h}時間${m % 60}分`
  }

  return (
    <div>
      <TopBar
        title="アナリティクス"
        actions={
          canExport ? (
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-1" />
              CSV エクスポート
            </Button>
          ) : null
        }
      />
      <div className="p-6 space-y-6">
        {/* Period selector */}
        <div className="flex items-center justify-between">
          <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>PERIOD</span>
          <div style={{ display: 'flex', border: '1px solid #CCCCCC', borderRadius: 999, overflow: 'hidden' }}>
            {(['7', '30', '90'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="font-mono uppercase transition-colors"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  padding: '6px 16px',
                  background: period === p ? '#000000' : 'transparent',
                  color: period === p ? '#FFFFFF' : '#999999',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {p}D
              </button>
            ))}
          </div>
        </div>

        {/* KPI stats — flat horizontal bar */}
        <div style={{ display: 'flex', borderTop: '1px solid #E8E8E8', borderBottom: '1px solid #E8E8E8', marginBottom: 0 }}>
          {[
            { label: '総リクエスト数', value: kpiLoading ? '...' : (kpi?.total ?? 0).toLocaleString(), sub: `過去${days}日間`, pct: null, color: null },
            { label: '承認率', value: kpiLoading ? '...' : `${kpi?.approvalRate ?? 0}%`, sub: '承認 + 自動承認', pct: kpi?.approvalRate ?? 0, color: getStatusColor(kpi?.approvalRate ?? 0) },
            { label: '平均応答時間', value: kpiLoading ? '...' : formatSeconds(kpi?.avgResponseSeconds ?? 0), sub: '手動承認・却下のみ', pct: null, color: null },
            { label: '自動承認率', value: kpiLoading ? '...' : `${kpi?.autoRate ?? 0}%`, sub: 'ルールによる自動処理', pct: kpi?.autoRate ?? 0, color: getStatusColor(kpi?.autoRate ?? 0) },
          ].map((item, i, arr) => (
            <div key={i} style={{ flex: 1, padding: '16px 24px', borderRight: i < arr.length - 1 ? '1px solid #E8E8E8' : 'none' }}>
              <span className="font-mono uppercase" style={{ fontSize: 10, color: '#AAAAAA', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{item.label}</span>
              <span className="font-mono" style={{ fontSize: 24, color: '#1A1A1A', lineHeight: 1, fontWeight: 400, display: 'block', marginBottom: 4 }}>{item.value}</span>
              <span className="font-mono" style={{ fontSize: 11, color: '#BBBBBB' }}>{item.sub}</span>
              {item.pct !== null && !kpiLoading && <SegBar pct={item.pct} color={item.color ?? undefined} />}
            </div>
          ))}
        </div>

        {/* Requests chart */}
        <div className="pt-2">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E8] mb-4">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[#999999]">リクエスト推移</span>
          </div>
          <RequestsChart tenantId={tenant_id} days={days} />
        </div>

        {/* Approver table */}
        <div className="pt-2">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E8] mb-0">
            <span className="font-mono text-[11px] uppercase tracking-widest text-[#999999]">承認者別パフォーマンス</span>
          </div>
          <ApproverTable tenantId={tenant_id} days={days} />
        </div>
      </div>
    </div>
  )
}
