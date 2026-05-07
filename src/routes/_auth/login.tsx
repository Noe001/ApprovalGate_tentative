import { useState } from 'react'
import type { CSSProperties } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上必要です'),
})

type LoginForm = z.infer<typeof loginSchema>

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
})

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--nd-border-visible)',
  outline: 'none',
  fontFamily: 'Space Mono, monospace',
  fontSize: 16,
  color: 'var(--nd-text-primary)',
  padding: '8px 0',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontFamily: 'Space Mono, monospace',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'var(--nd-text-secondary)',
  marginBottom: 8,
}

const errorStyle: CSSProperties = {
  fontFamily: 'Space Mono, monospace',
  fontSize: 10,
  color: 'var(--nd-accent)',
  letterSpacing: '0.06em',
  marginTop: 6,
}

function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          toast.error('メールアドレスの確認が完了していません。確認メールをご確認ください。')
        } else {
          toast.error('メールアドレスまたはパスワードが正しくありません')
        }
        return
      }

      const { data: memberships } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .limit(1)
        .maybeSingle()

      if (memberships) {
        navigate({ to: '/t/$tenant_id/dashboard', params: { tenant_id: memberships.tenant_id } })
      } else {
        navigate({ to: '/create-team' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--nd-bg)',
        backgroundImage: 'radial-gradient(circle, var(--nd-border-visible) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Hero header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1
            className="font-display"
            style={{ fontSize: 48, color: 'var(--nd-text-display)', lineHeight: 1, marginBottom: 12 }}
          >
            稟議ゲート（仮）
          </h1>
          <p
            className="font-mono uppercase"
            style={{ fontSize: 11, color: 'var(--nd-text-disabled)', letterSpacing: '0.1em' }}
          >
            AI AGENT APPROVAL SYSTEM
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          <div>
            <label htmlFor="login-email" style={labelStyle}>メールアドレス</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              style={inputStyle}
              {...register('email')}
              onFocus={(e) => { e.target.style.borderBottomColor = 'var(--nd-text-display)' }}
              onBlur={(e) => { e.target.style.borderBottomColor = 'var(--nd-border-visible)' }}
            />
            {errors.email && (
              <p style={errorStyle}>[ERROR: {errors.email.message}]</p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" style={labelStyle}>パスワード</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              style={inputStyle}
              {...register('password')}
              onFocus={(e) => { e.target.style.borderBottomColor = 'var(--nd-text-display)' }}
              onBlur={(e) => { e.target.style.borderBottomColor = 'var(--nd-border-visible)' }}
            />
            {errors.password && (
              <p style={errorStyle}>[ERROR: {errors.password.message}]</p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link
              to="/forgot-password"
              className="font-mono"
              style={{ fontSize: 11, color: 'var(--nd-interactive)', letterSpacing: '0.06em' }}
            >
              パスワードを忘れた方
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="font-mono uppercase"
            style={{
              width: '100%',
              padding: '12px 24px',
              background: loading ? 'var(--nd-text-disabled)' : 'var(--nd-text-display)',
              color: 'var(--nd-bg)',
              border: 'none',
              borderRadius: 9999,
              fontSize: 11,
              letterSpacing: '0.08em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'SIGNING IN...' : 'SIGN IN'}
          </button>
        </form>

        <p
          className="font-mono"
          style={{ textAlign: 'center', fontSize: 11, color: 'var(--nd-text-disabled)', marginTop: 32, letterSpacing: '0.06em' }}
        >
          アカウントをお持ちでない方は{' '}
          <Link
            to="/signup"
            style={{ color: 'var(--nd-interactive)' }}
          >
            新規登録
          </Link>
        </p>
      </div>
    </div>
  )
}
