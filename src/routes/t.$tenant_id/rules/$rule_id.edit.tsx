import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { requireAdminRole } from '@/lib/route-guards'
import { RULE_OPERATORS, RULE_FIELDS } from '@/lib/utils/rule-constants'

type Condition = {
  id?: string
  group: number
  field: string
  operator: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string
}

export const Route = createFileRoute('/t/$tenant_id/rules/$rule_id/edit')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: EditRulePage,
})

function EditRulePage() {
  const { tenant_id, rule_id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [ruleName, setRuleName] = useState('')
  const [actionType, setActionType] = useState<'auto_approve' | 'notify_approver' | 'auto_reject' | 'escalate'>('auto_approve')
  const [conditions, setConditions] = useState<Condition[]>([])
  const [loading, setLoading] = useState(false)

  const { data: rule } = useQuery({
    queryKey: ['rule', rule_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('rules')
        .select('*, rule_conditions(*)')
        .eq('id', rule_id)
        .single()
      return data
    },
  })

  useEffect(() => {
    if (rule) {
      setRuleName(rule.name)
      setActionType(rule.action_type)
      setConditions((rule.rule_conditions as unknown as Condition[]) ?? [])
    }
  }, [rule])

  const addCondition = () => {
    setConditions(prev => [...prev, { group: 0, field: 'reason', operator: 'contains', value: '' }])
  }

  const removeCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c))
  }

  const deleteRuleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('rules').delete().eq('id', rule_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules', tenant_id] })
      navigate({ to: '/t/$tenant_id/rules', params: { tenant_id } })
      toast.success('ルールを削除しました')
    },
  })

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    if (!ruleName.trim()) { toast.error('ルール名を入力してください'); return }

    setLoading(true)
    try {
      await supabase.from('rules').update({ name: ruleName, action_type: actionType }).eq('id', rule_id)
      await supabase.from('rule_conditions').delete().eq('rule_id', rule_id)
      if (conditions.length > 0) {
        await supabase.from('rule_conditions').insert(
          conditions.map(({ id: _id, ...c }) => ({ ...c, rule_id }))
        )
      }

      queryClient.invalidateQueries({ queryKey: ['rules', tenant_id] })
      queryClient.invalidateQueries({ queryKey: ['rule', rule_id] })
      toast.success('ルールを更新しました')
      navigate({ to: '/t/$tenant_id/rules', params: { tenant_id } })
    } catch {
      toast.error('更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopBar
        title="ルールを編集"
        actions={
          <Link to="/t/$tenant_id/rules" params={{ tenant_id }} className="flex items-center gap-1 text-sm text-gray-600">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Link>
        }
      />
      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4" style={{ border: '1px solid #E8E8E8', borderRadius: 8, padding: 24 }}>
            <div className="pb-3 border-b border-[#E8E8E8]">
              <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>BASIC</span>
            </div>
            <div>
              <label htmlFor="edit-rule-name" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>RULE NAME *</label>
              <input
                id="edit-rule-name"
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
              />
            </div>
            <div>
              <label htmlFor="edit-rule-action" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>ACTION</label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as typeof actionType)}>
                <SelectTrigger id="edit-rule-action"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_approve">自動承認</SelectItem>
                  <SelectItem value="auto_reject">自動却下</SelectItem>
                  <SelectItem value="notify_approver">承認者に通知</SelectItem>
                  <SelectItem value="escalate">エスカレーション</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4" style={{ border: '1px solid #E8E8E8', borderRadius: 8, padding: 24 }}>
            <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E8]">
              <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>CONDITIONS</span>
              <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                条件を追加
              </Button>
            </div>
            {conditions.map((cond, index) => (
              <div key={cond.id ?? `${cond.field}-${cond.operator}-${cond.value}`} className="flex gap-2 items-start p-3" style={{ border: '1px solid #E8E8E8', borderRadius: 4 }}>
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <Select value={cond.field} onValueChange={(v) => updateCondition(index, { field: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RULE_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={(v) => updateCondition(index, { operator: v as Condition['operator'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RULE_OPERATORS.map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <input
                    type="text"
                    value={cond.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    className="px-3 py-2 text-sm outline-none transition-colors"
                    style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                    onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                    onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                  />
                </div>
                <button type="button" onClick={() => removeCondition(index)} className="p-2 transition-colors" style={{ color: '#CCCCCC' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#D71921')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#CCCCCC')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? '更新中...' : '更新する'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate({ to: '/t/$tenant_id/rules', params: { tenant_id } })}>
                キャンセル
              </Button>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">ルールを削除</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ルールを削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>この操作は取り消せません。</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteRuleMutation.mutate()}
                    className="font-mono text-[12px] uppercase tracking-[0.06em] rounded-full"
                    style={{ background: 'transparent', border: '1px solid #D71921', color: '#D71921', padding: '8px 20px' }}
                  >
                    DELETE
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </form>
      </div>
    </div>
  )
}
