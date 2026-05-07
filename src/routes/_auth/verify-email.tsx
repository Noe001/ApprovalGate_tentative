import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/_auth/verify-email')({
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        supabase
          .from('tenant_members')
          .select('tenant_id')
          .limit(1)
          .single()
          .then(({ data }) => {
            if (data) {
              navigate({ to: '/t/$tenant_id/dashboard', params: { tenant_id: data.tenant_id } })
            } else {
              navigate({ to: '/create-team' })
            }
          })
        setStatus('success')
      } else {
        setStatus('error')
      }
    })
  }, [navigate])

  if (status === 'loading') {
    return (
      <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: 12, padding: 32, textAlign: 'center' }}>
        <p className="font-mono" style={{ fontSize: 11, color: '#CCCCCC', letterSpacing: '0.08em' }}>VERIFYING...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: 12, padding: 32, textAlign: 'center' }}>
        <h2 className="font-sans" style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>リンクが無効です</h2>
        <p className="font-mono" style={{ fontSize: 12, color: '#999999' }}>確認リンクの有効期限が切れているか、無効なリンクです。</p>
      </div>
    )
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: 12, padding: 32, textAlign: 'center' }}>
      <h2 className="font-sans" style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', marginBottom: 8 }}>メール確認完了</h2>
      <p className="font-mono" style={{ fontSize: 11, color: '#CCCCCC', letterSpacing: '0.08em' }}>REDIRECTING...</p>
    </div>
  )
}
