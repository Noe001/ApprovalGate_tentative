import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/common/StatusBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatRelative, formatTimeout } from '@/lib/utils/date'
import { TimeoutBar } from '@/components/common/TimeoutBar'
import { useUiStore } from '@/stores/ui-store'
import { STATUS_LABELS, type ApprovalStatus, type UserRole } from '@/types/enums'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/t/$tenant_id/approvals/')({
  component: ApprovalsPage,
})

function ApprovalsPage() {
  const { tenant_id } = Route.useParams()
  const { role } = Route.useRouteContext() as { role: UserRole }
  const queryClient = useQueryClient()
  const { selectedRequestIds, toggleRequestSelection, selectAllRequests, clearRequestSelection } = useUiStore()
  const canDecide = role === 'owner' || role === 'admin' || role === 'approver'

  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>('PENDING')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTarget, setRejectTarget] = useState<string | string[] | null>(null)

  const { data: projects } = useQuery({
    queryKey: ['projects-list', tenant_id],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').eq('tenant_id', tenant_id).is('deleted_at', null)
      return data ?? []
    },
  })

  const { data: requests, isLoading } = useQuery({
    queryKey: ['approvals', tenant_id, statusFilter, projectFilter],
    enabled: !!projects,
    queryFn: async () => {
      const projectIds = projectFilter === 'all'
        ? (projects?.map((p) => p.id) ?? [])
        : [projectFilter]

      if (projectIds.length === 0) return []

      let query = supabase
        .from('approval_requests')
        .select('id, reason, status, timeout_at, created_at, is_test, project_id, projects(name)')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(50)

      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter)
      }

      const { data } = await query
      return data ?? []
    },
    refetchInterval: 30_000,
  })

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('approval_requests')
        .update({ status: 'APPROVED', decided_by_id: user?.id, decided_at: new Date().toISOString() })
        .eq('id', requestId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', tenant_id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', tenant_id] })
      toast.success('承認しました')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('approval_requests')
        .update({ status: 'REJECTED', decided_by_id: user?.id, decided_at: new Date().toISOString(), rejection_reason: reason })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals', tenant_id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard', tenant_id] })
      setRejectTarget(null)
      setRejectReason('')
      toast.success('却下しました')
    },
  })

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('approval_requests')
        .update({ status: 'APPROVED', decided_by_id: user?.id, decided_at: new Date().toISOString() })
        .in('id', ids).eq('status', 'PENDING')
      if (error) throw error
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['approvals', tenant_id] })
      clearRequestSelection()
      toast.success(`${ids.length}件を一括承認しました`)
    },
  })

  const selectedArray = Array.from(selectedRequestIds)
  const allSelected = requests && requests.length > 0 && requests.every(r => selectedRequestIds.has(r.id))

  return (
    <div>
      <TopBar title="承認リクエスト" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ApprovalStatus | 'ALL')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="ステータス" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">すべて</SelectItem>
              {(Object.keys(STATUS_LABELS) as ApprovalStatus[]).map(s => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="プロジェクト" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべてのプロジェクト</SelectItem>
              {projects?.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canDecide && selectedArray.length > 0 && (
          <div className="flex items-center gap-3 border-b border-t border-[#E8E8E8] px-0 py-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#999999]">{selectedArray.length} SELECTED</span>
            <button
              onClick={() => bulkApproveMutation.mutate(selectedArray)}
              disabled={bulkApproveMutation.isPending}
              className="font-mono text-[11px] uppercase tracking-[0.06em] rounded-full"
              style={{ color: '#1A1A1A', border: '1px solid #CCCCCC', background: 'transparent', padding: '6px 16px' }}
            >
              BULK APPROVE
            </button>
            <button
              onClick={() => { setRejectTarget(selectedArray) }}
              className="font-mono text-[11px] uppercase tracking-[0.06em] rounded-full"
              style={{ color: '#D71921', border: '1px solid #D71921', background: 'transparent', padding: '6px 16px' }}
            >
              BULK REJECT
            </button>
            <button
              onClick={clearRequestSelection}
              className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#999999] ml-auto hover:text-[#1A1A1A] transition-colors"
            >
              CLEAR
            </button>
          </div>
        )}

        <div>
          {isLoading ? (
            <div className="p-8 text-center font-mono text-[11px]" style={{ color: '#CCCCCC' }}>読み込み中...</div>
          ) : !requests || requests.length === 0 ? (
            <EmptyState
              title="リクエストがありません"
              description="条件に一致するリクエストがありません"
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  {canDecide && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={!!allSelected}
                        onChange={(e) => {
                          if (e.target.checked) selectAllRequests(requests.map(r => r.id))
                          else clearRequestSelection()
                        }}
                        className="rounded"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#999999]">ACTION</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#999999]">PROJECT</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#999999]">STATUS</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#999999]">TIMEOUT</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#999999]">RECEIVED</th>
                  {canDecide && <th className="px-4 py-3 w-32" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                  {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-[#F0F0F0] transition-colors">
                    {canDecide && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRequestIds.has(req.id)}
                          onChange={() => toggleRequestSelection(req.id)}
                          className="rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link
                        to="/t/$tenant_id/approvals/$request_id"
                        params={{ tenant_id, request_id: req.id }}
                        className="text-sm text-[#1A1A1A] hover:text-[#007AFF] transition-colors"
                      >
                        {req.reason}
                        {req.is_test && <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.06em] text-[#999999]" style={{ border: '1px solid #CCCCCC', borderRadius: 4, padding: '1px 6px' }}>TEST</span>}
                      </Link>
                      {req.status === 'PENDING' && (
                        <TimeoutBar timeoutAt={req.timeout_at} createdAt={req.created_at} />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#999999]">
                      {(req.projects as unknown as { name: string })?.name}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status as ApprovalStatus} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {req.status === 'PENDING' ? (
                        <span style={{ color: '#D4A843' }}>{formatTimeout(req.timeout_at)}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#999999]">{formatRelative(req.created_at)}</td>
                    {canDecide && (
                      <td className="px-4 py-3">
                        {req.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveMutation.mutate(req.id)}
                            disabled={approveMutation.isPending}
                            className="font-mono text-[11px] uppercase tracking-[0.06em] rounded-full transition-colors"
                            style={{ color: '#1A1A1A', border: '1px solid #CCCCCC', background: 'transparent', padding: '4px 12px' }}
                          >
                            APPROVE
                          </button>
                          <button
                            onClick={() => { setRejectTarget(req.id); setRejectReason('') }}
                            className="font-mono text-[11px] uppercase tracking-[0.06em] rounded-full transition-colors"
                            style={{ color: '#D71921', border: '1px solid #D71921', background: 'transparent', padding: '4px 12px' }}
                          >
                            REJECT
                          </button>
                        </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>却下の理由</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="却下の理由を入力（任意）"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason('') }}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!rejectTarget) return
                if (Array.isArray(rejectTarget)) {
                  rejectTarget.forEach(id => rejectMutation.mutate({ id, reason: rejectReason }))
                } else {
                  rejectMutation.mutate({ id: rejectTarget, reason: rejectReason })
                }
              }}
              disabled={rejectMutation.isPending}
            >
              却下する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
