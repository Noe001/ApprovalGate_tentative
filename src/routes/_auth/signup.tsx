import { useState } from 'react'
import type { CSSProperties } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

const signupSchema = z.object({
  name: z.string().min(1, '名前を入力してください').max(50),
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上必要です'),
  passwordConfirm: z.string(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: 'パスワードが一致しません',
  path: ['passwordConfirm'],
})

type SignupForm = z.infer<typeof signupSchema>

export const Route = createFileRoute('/_auth/signup')({
  component: SignupPage,
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

const pageBackground: CSSProperties = {
  minHeight: '100vh',
  background: 'var(--nd-bg)',
  backgroundImage: 'radial-gradient(circle, var(--nd-border-visible) 1px, transparent 1px)',
  backgroundSize: '16px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
}

function SignupPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupForm) => {
    setLoading(true)
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: { name: data.name },
          emailRedirectTo: `${globalThis.location.origin}/verify-email`,
        },
      })
      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          toast.error('このメールアドレスはすでに登録されています')
        } else {
          toast.error('登録に失敗しました: ' + signUpError.message)
        }
        return
      }

      // When email confirmation is disabled, a session is returned immediately
      if (signUpData.session) {
        navigate({ to: '/create-team' })
        return
      }

      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div style={pageBackground}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <pre
            className="font-mono select-none"
            style={{ fontSize: 14, color: 'var(--nd-border-visible)', lineHeight: '1.8', letterSpacing: '0.3em', marginBottom: 32 }}
            aria-hidden="true"
          >
            {'· · · · ·\n· · · · ·\n· · · · ·\n· · · · ·\n· · · · ·'}
          </pre>
          <h2
            className="font-sans"
            style={{ fontSize: 20, color: 'var(--nd-text-display)', fontWeight: 500, marginBottom: 12 }}
          >
            確認メールを送信しました
          </h2>
          <p
            className="font-sans"
            style={{ fontSize: 14, color: 'var(--nd-text-secondary)' }}
          >
            メールに記載されたリンクをクリックしてアカウントを有効化してください。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={pageBackground}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Hero header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1
            className="font-display"
            style={{ fontSize: 48, color: 'var(--nd-text-display)', lineHeight: 1, marginBottom: 12 }}
          >
            新規登録
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
            <label htmlFor="signup-name" style={labelStyle}>お名前</label>
            <input
              id="signup-name"
              type="text"
              placeholder="田中 太郎"
              style={inputStyle}
              {...register('name')}
              onFocus={(e) => { e.target.style.borderBottomColor = 'var(--nd-text-display)' }}
              onBlur={(e) => { e.target.style.borderBottomColor = 'var(--nd-border-visible)' }}
            />
            {errors.name && (
              <p style={errorStyle}>[ERROR: {errors.name.message}]</p>
            )}
          </div>

          <div>
            <label htmlFor="signup-email" style={labelStyle}>メールアドレス</label>
            <input
              id="signup-email"
              type="email"
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
            <label htmlFor="signup-password" style={labelStyle}>パスワード</label>
            <input
              id="signup-password"
              type="password"
              style={inputStyle}
              {...register('password')}
              onFocus={(e) => { e.target.style.borderBottomColor = 'var(--nd-text-display)' }}
              onBlur={(e) => { e.target.style.borderBottomColor = 'var(--nd-border-visible)' }}
            />
            {errors.password && (
              <p style={errorStyle}>[ERROR: {errors.password.message}]</p>
            )}
          </div>

          <div>
            <label htmlFor="signup-password-confirm" style={labelStyle}>パスワード（確認）</label>
            <input
              id="signup-password-confirm"
              type="password"
              style={inputStyle}
              {...register('passwordConfirm')}
              onFocus={(e) => { e.target.style.borderBottomColor = 'var(--nd-text-display)' }}
              onBlur={(e) => { e.target.style.borderBottomColor = 'var(--nd-border-visible)' }}
            />
            {errors.passwordConfirm && (
              <p style={errorStyle}>[ERROR: {errors.passwordConfirm.message}]</p>
            )}
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
            {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p
          className="font-mono"
          style={{ textAlign: 'center', fontSize: 11, color: 'var(--nd-text-disabled)', marginTop: 32, letterSpacing: '0.06em' }}
        >
          すでにアカウントをお持ちの方は{' '}
          <Link
            to="/login"
            style={{ color: 'var(--nd-interactive)' }}
          >
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
