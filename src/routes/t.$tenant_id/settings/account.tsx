import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useThemeStore } from '@/stores/theme-store'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const profileSchema = z.object({
  name: z.string().min(1, '表示名を入力してください').max(100),
})

const passwordSchema = z
  .object({
    new_password: z
      .string()
      .min(8, 'パスワードは8文字以上で入力してください'),
    confirm_password: z.string().min(1, 'パスワードを再入力してください'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'パスワードが一致しません',
    path: ['confirm_password'],
  })

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

export const Route = createFileRoute('/t/$tenant_id/settings/account')({
  component: AccountSettingsPage,
})

function AccountSettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, loading: userLoading } = useCurrentUser()
  const { theme, setTheme } = useThemeStore()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle()
      return data
    },
  })

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: { name: profile?.name ?? '' },
  })

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('user_profiles')
        .update({ name: data.name })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('プロフィールを更新しました')
      queryClient.invalidateQueries({ queryKey: ['user-profile', user?.id] })
    },
    onError: () => {
      toast.error('プロフィールの更新に失敗しました')
    },
  })

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  const [savingPassword, setSavingPassword] = useState(false)

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.new_password,
      })
      if (error) throw error
      toast.success('パスワードを変更しました')
      resetPassword()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'パスワードの変更に失敗しました'
      toast.error(message)
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSignOutAll = async () => {
    setSigningOut(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) throw error
      navigate({ to: '/login' })
    } catch {
      toast.error('サインアウトに失敗しました')
      setSigningOut(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== '削除') return
    // Client-side admin API is not available; sign out and show contact message
    try {
      await supabase.auth.signOut()
    } finally {
      setDeleteOpen(false)
      toast.info('アカウント削除はサポートへお問い合わせください', {
        description: 'support@ringigate.com までご連絡ください',
        duration: 6000,
      })
    }
  }

  const isLoading = userLoading || profileLoading

  if (isLoading) {
    return (
      <div>
        <TopBar title="アカウント設定" />
        <div className="p-6 flex items-center justify-center h-48">
          <div className="text-sm text-gray-500">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title="アカウント設定" />
      <div className="p-6 max-w-2xl space-y-10">
        {/* Appearance */}
        <div className="space-y-5">
          <div className="border-b border-gray-200 pb-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">外観</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: '#1A1A1A' }}>ダークモード</p>
              <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>
                OLED ブラック (#000000) ベースの暗い表示に切り替えます
              </p>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </div>

        {/* Profile */}
        <div className="space-y-5">
          <div className="border-b border-gray-200 pb-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">プロフィール</span>
          </div>
          <form
            onSubmit={handleProfileSubmit((data) => profileMutation.mutate(data))}
            className="space-y-4"
          >
            <div>
              <label htmlFor="display-name" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                DISPLAY NAME
              </label>
              <input
                id="display-name"
                type="text"
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="山田 太郎"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...registerProfile('name')}
              />
              {profileErrors.name && (
                <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>
                  {profileErrors.name.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="email-display" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                EMAIL
              </label>
              <input
                id="email-display"
                type="email"
                value={user?.email ?? ''}
                readOnly
                className="w-full px-3 py-2 text-sm"
                style={{ border: 'none', borderBottom: '1px solid #E8E8E8', background: 'transparent', color: '#999999', borderRadius: 0, cursor: 'not-allowed' }}
              />
              <p className="font-mono mt-1" style={{ fontSize: 11, color: '#CCCCCC' }}>
                EMAIL CANNOT BE CHANGED
              </p>
            </div>
            <Button
              type="submit"
              disabled={profileMutation.isPending}
            >
              {profileMutation.isPending ? '保存中...' : 'プロフィールを保存'}
            </Button>
          </form>
        </div>

        {/* Password Change */}
        <div className="space-y-5">
          <div className="border-b border-gray-200 pb-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">パスワード変更</span>
          </div>
          <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-4">
            <div>
              <label htmlFor="new-password" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                NEW PASSWORD
              </label>
              <input
                id="new-password"
                type="password"
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="8文字以上"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...registerPassword('new_password')}
              />
              {passwordErrors.new_password && (
                <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>
                  {passwordErrors.new_password.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="confirm-password" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                CONFIRM PASSWORD
              </label>
              <input
                id="confirm-password"
                type="password"
                className="w-full px-3 py-2 text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="パスワードを再入力"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...registerPassword('confirm_password')}
              />
              {passwordErrors.confirm_password && (
                <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>
                  {passwordErrors.confirm_password.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={savingPassword}>
              {savingPassword ? '変更中...' : 'パスワードを変更'}
            </Button>
          </form>
        </div>

        {/* Session Management */}
        <div className="space-y-5">
          <div className="border-b border-gray-200 pb-3">
            <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">セッション管理</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: '#1A1A1A' }}>
                他のすべてのデバイスからサインアウト
              </p>
              <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>
                すべてのブラウザ・デバイスのセッションを終了します
              </p>
            </div>
            <Button
              variant="outline"
              disabled={signingOut}
              onClick={handleSignOutAll}
            >
              {signingOut ? 'サインアウト中...' : 'すべてサインアウト'}
            </Button>
          </div>
        </div>

        {/* Account Deletion */}
        <div className="space-y-4">
          <div className="pb-3" style={{ borderBottom: '1px solid rgba(215,25,33,0.3)' }}>
            <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#D71921' }}>ACCOUNT DELETION</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: '#1A1A1A' }}>アカウントを削除</p>
              <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>
                この操作は取り消せません
              </p>
            </div>
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  アカウントを削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>アカウントを削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    この操作は取り消せません。アカウントに関連するすべてのデータが失われます。
                    <br />
                    確認のため「<strong>削除</strong>」と入力してください。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-2">
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="削除"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirm('')}>
                    キャンセル
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="font-mono text-[12px] uppercase tracking-[0.06em] rounded-full"
                    style={{ background: 'transparent', border: '1px solid #D71921', color: '#D71921', padding: '8px 20px' }}
                    disabled={deleteConfirm !== '削除'}
                    onClick={handleDeleteAccount}
                  >
                    DELETE ACCOUNT
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  )
}
