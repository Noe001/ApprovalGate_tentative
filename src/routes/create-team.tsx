import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  name: z.string().min(1, 'チーム名を入力してください').max(100),
  slug: z.string()
    .min(3, 'スラッグは3文字以上必要です')
    .max(50)
    .regex(/^[a-z0-9-]+$/, '小文字英数字とハイフンのみ使用できます'),
})

type FormData = z.infer<typeof schema>

export const Route = createFileRoute('/create-team')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  component: CreateTeamPage,
})

function CreateTeamPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'slack' | 'done'>('form')
  const [tenantId, setTenantId] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50)
    setValue('slug', slug)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate({ to: '/login' })
        return
      }

      const newTenantId = crypto.randomUUID()

      const { error: tenantError } = await supabase
        .from('tenants')
        .insert({ id: newTenantId, name: data.name, slug: data.slug })

      if (tenantError) {
        if (tenantError.message.includes('duplicate')) {
          toast.error('このスラッグはすでに使用されています')
        } else {
          toast.error('チームの作成に失敗しました: ' + tenantError.message)
        }
        return
      }

      await supabase.from('tenant_members').insert({
        tenant_id: newTenantId,
        user_id: user.id,
        role: 'owner',
      })

      await supabase.from('subscriptions').insert({
        tenant_id: newTenantId,
        plan: 'starter',
        plan_limit_members: 5,
        plan_limit_requests: 100,
      })

      await supabase.from('notification_settings').insert({
        tenant_id: newTenantId,
      })

      if (!user.user_metadata?.profile_created) {
        await supabase.from('user_profiles').upsert({
          id: user.id,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'ユーザー',
          email_cached: user.email ?? null,
        })
      }

      setTenantId(newTenantId)
      setStep('slack')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'slack' && tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F8F8F8' }}>
        <div className="w-full max-w-lg" style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: 12, padding: 32 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 flex items-center justify-center font-mono" style={{ background: '#1A1A1A', borderRadius: '50%', color: '#FFFFFF', fontSize: 14 }}>2</div>
            <h2 className="text-xl" style={{ color: '#1A1A1A', fontWeight: 500 }}>Slack連携の設定</h2>
          </div>
          <p className="font-mono mb-6" style={{ fontSize: 12, color: '#999999' }}>
            樿議ゲートはSlackで承認リクエストを通知します。Slackワークスペースを連携してください。
          </p>
          <div className="p-4 mb-6" style={{ background: '#F8F8F8', border: '1px solid #E8E8E8', borderRadius: 8 }}>
            <p className="font-mono" style={{ fontSize: 11, color: '#999999' }}>Slack Appのインストールには、Slackワークスペースの管理者権限が必要です。</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate({ to: '/t/$tenant_id/settings/notifications', params: { tenant_id: tenantId } })}
              className="flex-1 py-2 px-4 font-mono uppercase text-sm"
              style={{ background: '#000000', color: '#FFFFFF', borderRadius: 100, border: 'none', letterSpacing: '0.06em' }}
            >
              NOTIFICATIONS
            </button>
            <button
              onClick={() => navigate({ to: '/t/$tenant_id/dashboard', params: { tenant_id: tenantId } })}
              className="py-2 px-4 font-mono uppercase text-sm"
              style={{ border: '1px solid #CCCCCC', background: 'transparent', color: '#999999', borderRadius: 100, letterSpacing: '0.06em' }}
            >
              LATER
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#F8F8F8' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="font-sans" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', color: '#000000' }}>稟議ゲート</h1>
          <p className="font-mono mt-1" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#CCCCCC' }}>AI AGENT EXECUTION MANAGEMENT</p>
        </div>
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: 12, padding: 32 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 flex items-center justify-center font-mono" style={{ background: '#1A1A1A', borderRadius: '50%', color: '#FFFFFF', fontSize: 14 }}>1</div>
            <h2 className="text-xl" style={{ color: '#1A1A1A', fontWeight: 500 }}>チームを作成</h2>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="team-name" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>TEAM NAME</label>
              <input
                id="team-name"
                type="text"
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="株式会社サンプル"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...register('name', {
                  onChange: onNameChange,
                })}
              />
              {errors.name && <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="team-slug" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>SLUG (URL ID)</label>
              <input
                id="team-slug"
                type="text"
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="sample-company"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...register('slug')}
              />
              {errors.slug && <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>{errors.slug.message}</p>}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 font-mono uppercase text-sm"
              style={{ background: '#000000', color: '#FFFFFF', borderRadius: 100, border: 'none', letterSpacing: '0.06em', opacity: loading ? 0.5 : 1 }}
            >
              {loading ? 'CREATING...' : 'CREATE TEAM'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
