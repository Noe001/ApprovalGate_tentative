import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS } from '@/types/enums'

const schema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上必要です'),
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: 'パスワードが一致しません',
  path: ['passwordConfirm'],
})

type FormData = z.infer<typeof schema>

export const Route = createFileRoute('/_auth/invite/$token')({
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState<{
    tenant_id: string
    email: string
    role: string
    tenants: { name: string }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isExistingUser, setIsExistingUser] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    async function loadInvitation() {
      const { data, error } = await supabase
        .from('invitations')
        .select('tenant_id, email, role, tenants(name)')
        .eq('token', token)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !data) {
        setLoading(false)
        return
      }

      setInvitation(data as unknown as typeof invitation)

      const { data: session } = await supabase.auth.getSession()
      if (session.session) {
        setIsExistingUser(true)
      }
      setLoading(false)
    }
    loadInvitation()
  }, [token])

  const onSubmit = async (data: FormData) => {
    if (!invitation) return
    setSubmitting(true)
    try {
      if (!isExistingUser) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: invitation.email,
          password: data.password,
          options: { data: { name: data.name } },
        })
        if (signUpError) {
          toast.error('登録に失敗しました')
          return
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('tenant_members').insert({
        tenant_id: invitation.tenant_id,
        user_id: user.id,
        role: invitation.role as 'owner' | 'admin' | 'approver' | 'viewer',
      })

      await supabase.from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('token', token)

      toast.success('チームに参加しました')
      navigate({ to: '/t/$tenant_id/dashboard', params: { tenant_id: invitation.tenant_id } })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="bg-white rounded-lg shadow-sm border p-8 text-center"><p className="text-gray-500">読み込み中...</p></div>
  }

  if (!invitation) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">招待リンクが無効です</h2>
        <p className="text-sm text-gray-500">招待リンクの有効期限が切れているか、無効なリンクです。</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">チームへの招待</h2>
      <p className="text-sm text-gray-500 mb-1">
        <strong>{invitation.tenants?.name}</strong> から{' '}
        <strong>{ROLE_LABELS[invitation.role as keyof typeof ROLE_LABELS]}</strong> として招待されています。
      </p>
      <p className="text-sm text-gray-400 mb-6">招待先: {invitation.email}</p>
      {!isExistingUser && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="invite-name" className="block text-sm font-medium text-gray-700 mb-1">お名前</label>
            <input id="invite-name" type="text" className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="invite-password" className="block text-sm font-medium text-gray-700 mb-1">パスワード設定</label>
            <input id="invite-password" type="password" className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('password')} />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>
          <div>
            <label htmlFor="invite-password-confirm" className="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
            <input id="invite-password-confirm" type="password" className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" {...register('passwordConfirm')} />
            {errors.passwordConfirm && <p className="text-xs text-red-500 mt-1">{errors.passwordConfirm.message}</p>}
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2 px-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitting ? '参加中...' : 'チームに参加する'}
          </button>
        </form>
      )}
      {isExistingUser && (
        <button
          onClick={handleSubmit(onSubmit)}
          disabled={submitting}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? '参加中...' : 'チームに参加する'}
        </button>
      )}
    </div>
  )
}
