import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Plus, GripVertical, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/common/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ACTION_TYPE_LABELS } from '@/types/enums'
import type { ActionType } from '@/types/enums'
import { requireAdminRole } from '@/lib/route-guards'

export const Route = createFileRoute('/t/$tenant_id/rules/')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: RulesPage,
})

function RulesPage() {
  const { tenant_id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const dragSrcId = useRef<string | null>(null)

  const { data: rules, isLoading } = useQuery({
    queryKey: ['rules', tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('rules')
        .select('*, rule_conditions(*)')
        .eq('tenant_id', tenant_id)
        .order('order', { ascending: true })
      return data ?? []
    },
  })

  useEffect(() => {
    if (rules) setOrderedIds(rules.map((r) => r.id))
  }, [rules])

  const orderedRules = orderedIds
    .map((id) => rules?.find((r) => r.id === id))
    .filter(Boolean) as NonNullable<typeof rules>

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('rules')
        .update({ is_active: isActive })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', tenant_id] })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(
        ids.map((id, i) => supabase.from('rules').update({ order: i }).eq('id', id))
      )
      const firstError = results.find((r) => r.error)?.error
      if (firstError) throw firstError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', tenant_id] })
      toast.success('順序を保存しました')
    },
    onError: () => {
      toast.error('順序の保存に失敗しました')
      if (rules) setOrderedIds(rules.map((r) => r.id))
    },
  })

  function handleDragStart(id: string) {
    dragSrcId.current = id
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    if (!dragSrcId.current || dragSrcId.current === overId) return
    setOrderedIds((prev) => {
      const from = prev.indexOf(dragSrcId.current!)
      const to = prev.indexOf(overId)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      next.splice(from, 1)
      next.splice(to, 0, dragSrcId.current!)
      return next
    })
  }

  function handleDrop() {
    dragSrcId.current = null
    reorderMutation.mutate(orderedIds)
  }

  return (
    <div>
      <TopBar
        title="ルール"
        actions={
          <Button onClick={() => navigate({ to: '/t/$tenant_id/rules/new', params: { tenant_id } })}>
            <Plus className="h-4 w-4 mr-1" />
            ルールを追加
          </Button>
        }
      />
      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        ) : !rules || rules.length === 0 ? (
          <EmptyState
            icon={<Zap />}
            title="ルールがありません"
            description="条件に基づいて自動承認・自動却下などの処理を設定できます"
            action={
              <Button onClick={() => navigate({ to: '/t/$tenant_id/rules/new', params: { tenant_id } })}>
                最初のルールを作成
              </Button>
            }
          />
        ) : (
          <div className="border-t border-[#E8E8E8]">
            <p className="font-mono uppercase mt-4 mb-4" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>
              RULES ARE EVALUATED TOP TO BOTTOM — FIRST MATCH WINS
            </p>
            {orderedRules.map((rule, index) => (
              <div
                key={rule.id}
                draggable
                onDragStart={() => handleDragStart(rule.id)}
                onDragOver={(e) => handleDragOver(e, rule.id)}
                onDrop={handleDrop}
                className="flex items-center gap-4 py-4 border-b border-[#E8E8E8] last:border-b-0 transition-colors"
                style={{ opacity: rule.is_active ? 1 : 0.4 }}
              >
                <div className="flex items-center cursor-grab active:cursor-grabbing" style={{ color: '#CCCCCC' }}>
                  <span className="font-mono text-[11px] mr-2" style={{ color: '#CCCCCC' }}>{index + 1}</span>
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm" style={{ color: '#1A1A1A' }}>{rule.name}</span>
                    {rule.project_id && (
                      <span
                        className="font-mono uppercase"
                        style={{ fontSize: 9, letterSpacing: '0.06em', color: '#999999', border: '1px solid #CCCCCC', borderRadius: 4, padding: '1px 6px' }}
                      >
                        PROJECT
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.06em',
                        color:
                          rule.action_type === 'auto_approve' ? '#4A9E5C' :
                          rule.action_type === 'auto_reject' ? '#D71921' :
                          rule.action_type === 'escalate' ? '#D4A843' :
                          '#999999',
                      }}
                    >
                      {ACTION_TYPE_LABELS[rule.action_type as ActionType]}
                    </span>
                    <span className="font-mono" style={{ fontSize: 10, color: '#CCCCCC' }}>
                      {(rule.rule_conditions as unknown as Array<unknown>)?.length ?? 0} CONDITIONS
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                  />
                  <Link
                    to="/t/$tenant_id/rules/$rule_id/edit"
                    params={{ tenant_id, rule_id: rule.id }}
                    className="font-mono text-[11px] uppercase tracking-[0.06em] transition-colors"
                    style={{ color: '#999999' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#007AFF')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#999999')}
                  >
                    EDIT
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
