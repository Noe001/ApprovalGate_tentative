import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { requireAdminRole } from '@/lib/route-guards'
import { RULE_OPERATORS, RULE_FIELDS } from '@/lib/utils/rule-constants'

const conditionSchema = z.object({
  group: z.number(),
  field: z.string(),
  operator: z.enum(['contains', 'not_contains', 'equals', 'not_equals', 'gt', 'gte', 'lt', 'lte']),
  value: z.string(),
})

type Condition = z.infer<typeof conditionSchema>

export const Route = createFileRoute('/t/$tenant_id/rules/new')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: NewRulePage,
})

function NewRulePage() {
  const { tenant_id } = Route.useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [conditions, setConditions] = useState<Condition[]>([
    { group: 0, field: 'reason', operator: 'contains', value: '' },
  ])
  const [actionType, setActionType] = useState<'auto_approve' | 'notify_approver' | 'auto_reject' | 'escalate'>('auto_approve')
  const [ruleName, setRuleName] = useState('')

  const addCondition = () => {
    setConditions(prev => [...prev, { group: 0, field: 'reason', operator: 'contains', value: '' }])
  }

  const removeCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c))
  }

  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    if (!ruleName.trim()) { toast.error('ルール名を入力してください'); return }
    if (conditions.some(c => !c.value.trim())) { toast.error('すべての条件の値を入力してください'); return }

    setLoading(true)
    try {
      const existingRules = await supabase
        .from('rules')
        .select('order')
        .eq('tenant_id', tenant_id)
        .order('order', { ascending: false })
        .limit(1)

      const maxOrder = (existingRules.data?.[0]?.order ?? 0) + 1

      const { data: rule, error } = await supabase
        .from('rules')
        .insert({
          tenant_id,
          name: ruleName,
          action_type: actionType,
          order: maxOrder,
          action_config: {},
        })
        .select()
        .single()

      if (error) throw error

      await supabase.from('rule_conditions').insert(
        conditions.map(c => ({ ...c, rule_id: rule.id }))
      )

      toast.success('ルールを作成しました')
      navigate({ to: '/t/$tenant_id/rules', params: { tenant_id } })
    } catch {
      toast.error('ルールの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopBar
        title="ルールを追加"
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
              <label htmlFor="rule-name" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>RULE NAME *</label>
              <input
                id="rule-name"
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="大量メール送信を自動却下"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
              />
            </div>
            <div>
              <label htmlFor="rule-action" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>ACTION</label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as typeof actionType)}>
                <SelectTrigger id="rule-action">
                  <SelectValue />
                </SelectTrigger>
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
            <p className="font-mono" style={{ fontSize: 11, color: '#999999' }}>同じグループの条件はAND（すべて満たす）、異なるグループはOR（いずれかを満たす）で評価されます。</p>
            {conditions.map((cond, index) => (
              <div key={`${cond.field}-${cond.operator}-${cond.value}`} className="flex gap-2 items-start p-3" style={{ border: '1px solid #E8E8E8', borderRadius: 4 }}>
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <Select value={cond.field} onValueChange={(v) => updateCondition(index, { field: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_FIELDS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={(v) => updateCondition(index, { operator: v as Condition['operator'] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="text"
                    value={cond.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                    placeholder="値"
                    className="px-3 py-2 text-sm outline-none transition-colors"
                    style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                    onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                    onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                  />
                </div>
                {conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="p-2 transition-colors"
                    style={{ color: '#CCCCCC' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#D71921')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#CCCCCC')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? '作成中...' : 'ルールを作成'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: '/t/$tenant_id/rules', params: { tenant_id } })}
            >
              キャンセル
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
