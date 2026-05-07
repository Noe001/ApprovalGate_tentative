import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatDate, formatRelative, formatTimeout } from '@/lib/utils/date'
import { useRealtimeApprovalStatus } from '@/hooks/use-realtime-approval'
import type { ApprovalStatus, UserRole } from '@/types/enums'

export const Route = createFileRoute('/t/$tenant_id/approvals/$request_id')({
  component: ApprovalDetailPage,
})

function ApprovalDetailPage() {
  const { tenant_id, request_id } = Route.useParams()
  const { role } = Route.useRouteContext() as { role: UserRole }
  const queryClient = useQueryClient()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useRealtimeApprovalStatus(request_id)

  const { data: req, isLoading } = useQuery({
    queryKey: ['approval', request_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*, projects(name, tenant_id)')
        .eq('id', request_id)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: auditLogs } = useQuery({
    queryKey: ['audit-logs', request_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('*, actor_id')
        .eq('resource_type', 'approval_request')
        .eq('resource_id', request_id)
        .order('created_at', { ascending: true })
      return data ?? []
    },
  })

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('approval_requests')
        .update({ status: 'APPROVED', decided_by_id: user?.id, decided_at: new Date().toISOString() })
        .eq('id', request_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval', request_id] })
      queryClient.invalidateQueries({ queryKey: ['approvals', tenant_id] })
      toast.success('承認しました')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('approval_requests')
        .update({ status: 'REJECTED', decided_by_id: user?.id, decided_at: new Date().toISOString(), rejection_reason: reason })
        .eq('id', request_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval', request_id] })
      setRejectOpen(false)
      toast.success('却下しました')
    },
  })

  if (isLoading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>
  if (!req) return <div className="p-8 text-center text-gray-500">リクエストが見つかりません</div>

  const metadata = (req.metadata as Record<string, unknown>) ?? {}
  const metaEntries = Object.entries(metadata).slice(0, 5)
  const canDecide = role === 'owner' || role === 'admin' || role === 'approver'

  return (
    <div>
      <TopBar
        title="承認リクエスト詳細"
        actions={
          <Link
            to="/t/$tenant_id/approvals"
            params={{ tenant_id }}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            一覧に戻る
          </Link>
        }
      />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E8E8', padding: 24 }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="font-sans" style={{ fontSize: 24, lineHeight: 1.2, letterSpacing: '-0.01em', color: '#000000' }}>{req.reason}</h2>
                <StatusBadge status={req.status as ApprovalStatus} />
                {req.is_test && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-[#999999]" style={{ border: '1px solid #CCCCCC', borderRadius: 4, padding: '1px 6px' }}>TEST</span>
                )}
              </div>
              {req.description && <p className="text-sm text-[#666666]">{req.description}</p>}
              <p className="font-mono mt-1" style={{ fontSize: 11, color: '#999999', letterSpacing: '0.04em' }}>
                {(req.projects as unknown as { name: string })?.name} · {formatRelative(req.created_at)}
              </p>
            </div>
            {req.status === 'PENDING' && (
              <div className="flex items-center gap-2 font-mono" style={{ fontSize: 12, color: '#D4A843' }}>
                <Clock className="h-4 w-4" />
                {formatTimeout(req.timeout_at)}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Metadata */}
          {metaEntries.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E8E8', padding: 24 }}>
              <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', display: 'block', marginBottom: 16 }}>DETAILS</span>
              <dl className="space-y-3">
                {metaEntries.map(([key, value]) => (
                  <div key={key} className="flex gap-3">
                    <dt className="font-mono" style={{ fontSize: 11, color: '#999999', minWidth: 96, paddingTop: 2, letterSpacing: '0.04em' }}>{key}</dt>
                    <dd className="text-sm" style={{ color: '#1A1A1A', wordBreak: 'break-all' }}>{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Info */}
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E8E8', padding: 24 }}>
            <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', display: 'block', marginBottom: 16 }}>REQUEST INFO</span>
            <dl className="space-y-3">
              <div className="flex gap-3">
                <dt className="font-mono" style={{ fontSize: 11, color: '#999999', minWidth: 96, letterSpacing: '0.04em' }}>RECEIVED</dt>
                <dd className="text-sm" style={{ color: '#1A1A1A' }}>{formatDate(req.created_at)}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="font-mono" style={{ fontSize: 11, color: '#999999', minWidth: 96, letterSpacing: '0.04em' }}>TIMEOUT</dt>
                <dd className="text-sm" style={{ color: '#1A1A1A' }}>{formatDate(req.timeout_at)}</dd>
              </div>
              {req.decided_at && (
                <div className="flex gap-3">
                  <dt className="font-mono" style={{ fontSize: 11, color: '#999999', minWidth: 96, letterSpacing: '0.04em' }}>DECIDED</dt>
                  <dd className="text-sm" style={{ color: '#1A1A1A' }}>{formatDate(req.decided_at)}</dd>
                </div>
              )}
              {req.rejection_reason && (
                <div className="flex gap-3">
                  <dt className="font-mono" style={{ fontSize: 11, color: '#999999', minWidth: 96, letterSpacing: '0.04em' }}>REASON</dt>
                  <dd className="text-sm" style={{ color: '#D71921' }}>{req.rejection_reason}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Audit log */}
        {auditLogs && auditLogs.length > 0 && (
          <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E8E8', padding: 24 }}>
            <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', display: 'block', marginBottom: 16 }}>TIMELINE</span>
            <div className="space-y-3">
              {auditLogs.map((log, i) => (
                <div key={log.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 mt-1.5 shrink-0" style={{ background: '#1A1A1A' }} />
                    {i < auditLogs.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: '#E8E8E8' }} />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm" style={{ color: '#1A1A1A' }}>{log.action}</p>
                    <p className="font-mono" style={{ fontSize: 11, color: '#999999' }}>{formatRelative(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {canDecide && req.status === 'PENDING' && (
          <div className="flex gap-3">
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="font-mono uppercase tracking-[0.06em] rounded-full transition-colors"
              style={{ fontSize: 13, background: '#000000', color: '#FFFFFF', border: 'none', padding: '12px 24px', cursor: 'pointer', opacity: approveMutation.isPending ? 0.4 : 1 }}
            >
              APPROVE
            </button>
            <button
              onClick={() => setRejectOpen(true)}
              className="font-mono uppercase tracking-[0.06em] rounded-full transition-colors"
              style={{ fontSize: 13, background: 'transparent', color: '#D71921', border: '1px solid #D71921', padding: '12px 24px', cursor: 'pointer' }}
            >
              REJECT
            </button>
          </div>
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>却下の理由</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="却下の理由を入力（任意、最大500文字）"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>キャンセル</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectReason)}
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
