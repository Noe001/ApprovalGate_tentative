import { useQuery } from '@tanstack/react-query'
import { subDays, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/common/EmptyState'
import { Users } from 'lucide-react'

interface ApproverTableProps {
  tenantId: string
  days?: number
}

interface ApproverRow {
  actorId: string
  name: string
  decisions: number
  avgResponseSeconds: number
  approvalRate: number
}

export function ApproverTable({ tenantId, days = 30 }: ApproverTableProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['approver-table', tenantId, days],
    queryFn: async () => {
      const since = subDays(new Date(), days).toISOString()

      // Fetch decided approval requests in the period for this tenant's projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)

      const projectIds = projectsData?.map((p) => p.id) ?? []
      if (projectIds.length === 0) return []

      const { data: requests } = await supabase
        .from('approval_requests')
        .select('id, status, decided_by_id, created_at, decided_at')
        .in('project_id', projectIds)
        .in('status', ['APPROVED', 'REJECTED'])
        .not('decided_by_id', 'is', null)
        .not('decided_at', 'is', null)
        .gte('created_at', since)

      if (!requests || requests.length === 0) return []

      // Aggregate by decided_by_id
      const byActor: Record<
        string,
        { approved: number; rejected: number; totalSeconds: number }
      > = {}

      for (const req of requests) {
        const actor = req.decided_by_id!
        if (!byActor[actor]) {
          byActor[actor] = { approved: 0, rejected: 0, totalSeconds: 0 }
        }
        if (req.status === 'APPROVED') byActor[actor].approved++
        else byActor[actor].rejected++

        const responseSeconds =
          (parseISO(req.decided_at!).getTime() - parseISO(req.created_at).getTime()) / 1000
        byActor[actor].totalSeconds += responseSeconds
      }

      // Fetch user profiles for actor IDs
      const actorIds = Object.keys(byActor)
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name')
        .in('id', actorIds)

      const profileMap: Record<string, string> = {}
      for (const p of profiles ?? []) {
        profileMap[p.id] = p.name
      }

      const rows: ApproverRow[] = actorIds.map((actorId) => {
        const stats = byActor[actorId]
        const decisions = stats.approved + stats.rejected
        const avgResponseSeconds = decisions > 0 ? Math.round(stats.totalSeconds / decisions) : 0
        const approvalRate = decisions > 0 ? Math.round((stats.approved / decisions) * 100) : 0
        return {
          actorId,
          name: profileMap[actorId] ?? actorId.slice(0, 8) + '...',
          decisions,
          avgResponseSeconds,
          approvalRate,
        }
      })

      return rows.sort((a, b) => b.decisions - a.decisions)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="承認者データがありません"
        description="選択した期間に承認・却下のアクションがありませんでした"
      />
    )
  }

  function formatSeconds(s: number): string {
    if (s < 60) return `${s}秒`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}分`
    const h = Math.floor(m / 60)
    return `${h}時間${m % 60}分`
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-4 py-3 font-mono uppercase text-[10px] tracking-[0.08em]" style={{ color: '#999999' }}>承認者</th>
            <th className="px-4 py-3 font-mono uppercase text-[10px] tracking-[0.08em] text-right" style={{ color: '#999999' }}>判断回数</th>
            <th className="px-4 py-3 font-mono uppercase text-[10px] tracking-[0.08em] text-right" style={{ color: '#999999' }}>平均応答時間</th>
            <th className="px-4 py-3 font-mono uppercase text-[10px] tracking-[0.08em] text-right" style={{ color: '#999999' }}>承認率</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((row) => (
            <tr key={row.actorId} className="hover:bg-[#F0F0F0] transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background: '#E8E8E8' }}>
                    <span className="text-xs font-mono" style={{ color: '#1A1A1A' }}>
                      {row.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm" style={{ color: '#1A1A1A' }}>{row.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: '#1A1A1A' }}>
                {row.decisions.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums" style={{ color: '#1A1A1A' }}>
                {formatSeconds(row.avgResponseSeconds)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {(() => {
                    let rateColor: string
                    if (row.approvalRate >= 70) rateColor = '#4A9E5C'
                    else if (row.approvalRate >= 40) rateColor = '#D4A843'
                    else rateColor = '#D71921'
                    const filled = Math.round((row.approvalRate / 100) * 8)
                    return (
                      <>
                        <div style={{ display: 'flex', gap: 1 }}>
                          {Array.from({ length: 8 }).map((_, i) => (
                            <div key={`${row.actorId}-seg-${i}`} style={{ width: 4, height: 12, background: i < filled ? rateColor : '#E8E8E8' }} />
                          ))}
                        </div>
                        <span className="font-mono tabular-nums" style={{ fontSize: 12, color: rateColor }}>
                          {row.approvalRate}%
                        </span>
                      </>
                    )
                  })()}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
