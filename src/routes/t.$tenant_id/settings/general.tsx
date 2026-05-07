import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import type { UserRole } from '@/types/enums'
import { requireAdminRole } from '@/lib/route-guards'

const TIMEZONES = [
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'UTC', label: 'UTC' },
]

const schema = z.object({
  name: z.string().min(1, 'チーム名を入力してください').max(100),
  timezone: z.string().min(1),
  default_timeout_seconds: z
    .number({ invalid_type_error: '数値を入力してください' })
    .min(60, '60秒以上を指定してください')
    .max(86400, '86400秒以下を指定してください'),
  default_timeout_behavior: z.enum(['deny', 'allow']),
})

type FormData = z.infer<typeof schema>

export const Route = createFileRoute('/t/$tenant_id/settings/general')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: GeneralSettingsPage,
})

function GeneralSettingsPage() {
  const { tenant_id } = Route.useParams()
  const ctx = Route.useRouteContext() as { role: UserRole; tenantName: string }
  const { role } = ctx
  const navigate = useNavigate()

  const [saving, setSaving] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const canEdit = role === 'owner' || role === 'admin'
  const isOwner = role === 'owner'

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenant_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenant_id)
        .single()
      if (error) throw error
      return data
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      timezone: 'Asia/Tokyo',
      default_timeout_seconds: 1800,
      default_timeout_behavior: 'deny',
    },
  })

  useEffect(() => {
    if (tenant) {
      reset({
        name: tenant.name,
        timezone: tenant.timezone,
        default_timeout_seconds: tenant.default_timeout_seconds,
        default_timeout_behavior: tenant.default_timeout_behavior,
      })
    }
  }, [tenant, reset])

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: data.name,
          timezone: data.timezone,
          default_timeout_seconds: data.default_timeout_seconds,
          default_timeout_behavior: data.default_timeout_behavior,
        })
        .eq('id', tenant_id)
      if (error) throw error
      toast.success('設定を保存しました')
    } catch {
      toast.error('設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTenant = async () => {
    if (deleteConfirmName !== tenant?.name) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('tenants')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', tenant_id)
      if (error) throw error
      toast.success('チームを削除しました')
      navigate({ to: '/create-team' })
    } catch {
      toast.error('チームの削除に失敗しました')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <TopBar title="一般設定" />
        <div className="p-6 flex items-center justify-center h-48">
          <div className="text-sm text-gray-500">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title="一般設定" />
      <div className="p-6 max-w-2xl space-y-10">
        {canEdit && (
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-3">
              <span className="font-mono text-[11px] uppercase tracking-widest text-gray-400">チーム設定</span>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label htmlFor="tenant-name" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                  TEAM NAME
                </label>
                <input
                  id="tenant-name"
                  type="text"
                  className="w-full px-3 py-2 text-sm outline-none transition-colors"
                  style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                  placeholder="株式会社サンプル"
                  onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                  onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="tenant-timezone" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                  TIMEZONE
                </label>
                <Select
                  value={watch('timezone')}
                  onValueChange={(v) => setValue('timezone', v)}
                >
                  <SelectTrigger id="tenant-timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="tenant-default-timeout" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                  DEFAULT TIMEOUT (SEC)
                </label>
                <input
                  id="tenant-default-timeout"
                  type="number"
                  min={60}
                  max={86400}
                  className="w-full px-3 py-2 font-mono text-sm outline-none transition-colors"
                  style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                  placeholder="1800"
                  onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                  onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                  {...register('default_timeout_seconds', { valueAsNumber: true })}
                />
                {errors.default_timeout_seconds && (
                  <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>
                    {errors.default_timeout_seconds.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="tenant-timeout-behavior" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                  ON TIMEOUT
                </label>
                <Select
                  value={watch('default_timeout_behavior')}
                  onValueChange={(v) =>
                    setValue('default_timeout_behavior', v as 'deny' | 'allow')
                  }
                >
                  <SelectTrigger id="tenant-timeout-behavior">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">タイムアウト時に自動承認</SelectItem>
                    <SelectItem value="deny">タイムアウト時に自動拒否</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? '保存中...' : '設定を保存'}
              </Button>
            </form>
          </div>
        )}

        {isOwner && (
          <div className="space-y-4">
            <div className="pb-3" style={{ borderBottom: '1px solid rgba(215,25,33,0.3)' }}>
              <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#D71921' }}>DANGER ZONE</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm" style={{ color: '#1A1A1A' }}>チームを削除</p>
                <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>
                  チームとすべてのデータが完全に削除されます
                </p>
              </div>
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    チームを削除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>チームを削除しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      この操作は取り消せません。チーム「{tenant?.name}
                      」とすべての関連データが完全に削除されます。
                      <br />
                      確認のためチーム名「
                      <strong>{tenant?.name}</strong>」を入力してください。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="my-2">
                    <input
                      type="text"
                      value={deleteConfirmName}
                      onChange={(e) => setDeleteConfirmName(e.target.value)}
                      placeholder={tenant?.name ?? ''}
                      className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => setDeleteConfirmName('')}
                    >
                      キャンセル
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="font-mono text-[12px] uppercase tracking-[0.06em] rounded-full"
                      style={{ background: 'transparent', border: '1px solid #D71921', color: '#D71921', padding: '8px 20px' }}
                      disabled={deleteConfirmName !== tenant?.name || deleting}
                      onClick={handleDeleteTenant}
                    >
                      {deleting ? 'DELETING...' : 'DELETE TEAM'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
