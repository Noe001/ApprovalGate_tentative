import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { requireAdminRole } from '@/lib/route-guards'

const schema = z.object({
  name: z.string().min(1, '名前を入力してください').max(100),
  description: z.string().max(500).optional(),
  approver_mode: z.enum(['any', 'all']),
  timeout_seconds: z.preprocess(
    val => (val === '' || val === undefined || (typeof val === 'number' && Number.isNaN(val))) ? undefined : Number(val),
    z.number().min(60).max(86400).optional()
  ),
})

type FormData = z.infer<typeof schema>

export const Route = createFileRoute('/t/$tenant_id/projects/new')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: NewProjectPage,
})

function NewProjectPage() {
  const { tenant_id } = Route.useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { approver_mode: 'any' },
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          tenant_id,
          name: data.name,
          description: data.description ?? null,
          approver_mode: data.approver_mode,
          timeout_seconds: data.timeout_seconds ?? null,
        })
        .select()
        .single()

      if (error) {
        toast.error('プロジェクトの作成に失敗しました')
        return
      }

      toast.success('プロジェクトを作成しました')
      navigate({ to: '/t/$tenant_id/projects/$project_id', params: { tenant_id, project_id: project.id } })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <TopBar
        title="新規プロジェクト"
        actions={
          <Link to="/t/$tenant_id/projects" params={{ tenant_id }} className="flex items-center gap-1 text-sm text-gray-600">
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Link>
        }
      />
      <div className="p-6 max-w-2xl">
        <div className="space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="project-name" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>PROJECT NAME *</label>
              <input
                id="project-name"
                type="text"
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="marketing-agent"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...register('name')}
              />
              {errors.name && <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="project-description" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>説明</label>
              <textarea
                id="project-description"
                className="w-full px-3 py-2 text-sm outline-none transition-colors min-h-20"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0, resize: 'none' }}
                placeholder="このプロジェクトの説明..."
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...register('description')}
              />
            </div>

            <div>
              <label htmlFor="project-approver-mode" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>承認モード</label>
              <Select
                value={watch('approver_mode')}
                onValueChange={(v) => setValue('approver_mode', v as 'any' | 'all')}
              >
                <SelectTrigger id="project-approver-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">いずれか1名の承認（OR）</SelectItem>
                  <SelectItem value="all">全員の承認が必要（AND）</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="project-timeout-seconds" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>TIMEOUT (秒) (未設定の場合はテナント設定を使用)</label>
              <input
                id="project-timeout-seconds"
                type="number"
                min={60}
                max={86400}
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="1800"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...register('timeout_seconds')}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? '作成中...' : 'プロジェクトを作成'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: '/t/$tenant_id/projects', params: { tenant_id } })}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
