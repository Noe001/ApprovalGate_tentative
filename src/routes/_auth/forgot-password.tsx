import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
})

type FormData = z.infer<typeof schema>

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        toast.error('送信に失敗しました')
        return
      }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: 12, padding: 32, textAlign: 'center' }}>
        <h2 className="font-sans" style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>メールを送信しました</h2>
        <p className="font-mono" style={{ fontSize: 12, color: '#999999', marginBottom: 16 }}>パスワードリセット用のリンクをメールで送信しました。</p>
        <Link to="/login" className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>
          BACK TO LOGIN
        </Link>
      </div>
    )
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: 12, padding: 32 }}>
      <h2 className="font-sans" style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>パスワードをリセット</h2>
      <p className="font-mono" style={{ fontSize: 12, color: '#999999', marginBottom: 24 }}>
        登録したメールアドレスを入力してください。パスワードリセット用のリンクを送信します。
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="fp-email" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>メールアドレス</label>
          <input
            id="fp-email"
            type="email"
            className="w-full px-3 py-2 text-sm outline-none transition-colors"
            style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
            onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
            onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
            {...register('email')}
          />
          {errors.email && <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>{errors.email.message}</p>}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 font-mono uppercase text-sm"
          style={{ background: '#000000', color: '#FFFFFF', borderRadius: 100, border: 'none', letterSpacing: '0.06em', opacity: loading ? 0.5 : 1 }}
        >
          {loading ? 'SENDING...' : 'SEND RESET EMAIL'}
        </button>
      </form>
      <p className="text-center font-mono mt-6" style={{ fontSize: 11, letterSpacing: '0.06em' }}>
        <Link to="/login" style={{ color: '#999999' }}>BACK TO LOGIN</Link>
      </p>
    </div>
  )
}
