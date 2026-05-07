import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { requireAdminRole } from '@/lib/route-guards'

const schema = z.object({
  webhook_url: z.preprocess(
    (v) => (!v || v === '' ? undefined : v),
    z.string().url('有効なURLを入力してください').optional()
  ),
  channel_name: z.string().max(100).optional(),
  enabled: z.boolean(),
})

type FormData = z.infer<typeof schema>

export const Route = createFileRoute('/t/$tenant_id/settings/notifications')({
  beforeLoad: ({ context }) => requireAdminRole(context.role),
  component: NotificationsSettingsPage,
})

function NotificationsSettingsPage() {
  const { tenant_id } = Route.useParams()
  const queryClient = useQueryClient()
  const [testing, setTesting] = useState(false)

  const { data: notifSettings, isLoading } = useQuery({
    queryKey: ['notification-settings', tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('tenant_id', tenant_id)
        .maybeSingle()
      return data
    },
  })

  const isConnected = Boolean(notifSettings?.slack_connected_at)
  // slack_bot_token is repurposed as webhook URL storage in this UI;
  // full OAuth connection happens server-side via Edge Functions.
  const currentWebhookUrl = notifSettings?.slack_bot_token ?? ''
  const currentChannelName = notifSettings?.slack_channel_id ?? ''
  const currentEnabled = notifSettings?.email_notifications_enabled ?? false

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      webhook_url: currentWebhookUrl,
      channel_name: currentChannelName,
      enabled: currentEnabled,
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (notifSettings) {
        const { error } = await supabase
          .from('notification_settings')
          .update({
            slack_bot_token: data.webhook_url ?? null,
            slack_channel_id: data.channel_name ?? null,
            slack_connected_at: data.webhook_url ? new Date().toISOString() : null,
            email_notifications_enabled: data.enabled,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenant_id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('notification_settings')
          .insert({
            tenant_id,
            slack_bot_token: data.webhook_url ?? null,
            slack_channel_id: data.channel_name ?? null,
            slack_connected_at: data.webhook_url ? new Date().toISOString() : null,
            email_notifications_enabled: data.enabled,
          })
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success('設定を保存しました')
      queryClient.invalidateQueries({ queryKey: ['notification-settings', tenant_id] })
    },
    onError: () => {
      toast.error('設定の保存に失敗しました')
    },
  })

  const onSubmit = (data: FormData) => {
    saveMutation.mutate(data)
  }

  const handleTestNotification = async () => {
    const webhookUrl = watch('webhook_url')
    if (!webhookUrl) {
      toast.error('Webhook URLを入力してください')
      return
    }

    setTesting(true)
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '✅ 稟議ゲート（仮） (RingiGate) からのテスト通知です。Slack連携が正常に設定されています。',
        }),
      })
      if (response.ok) {
        toast.success('テスト通知を送信しました')
      } else {
        toast.error('テスト通知の送信に失敗しました（Webhookが応答しませんでした）')
      }
    } catch {
      toast.error('テスト通知の送信に失敗しました（ネットワークエラー）')
    } finally {
      setTesting(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <TopBar title="通知設定" />
        <div className="p-6 flex items-center justify-center h-48">
          <div className="text-sm text-gray-500">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title="通知設定" />
      <div className="p-6 max-w-2xl space-y-10">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#E8E8E8] pb-3">
            <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>SLACK INTEGRATION</span>
            {isConnected ? (
              <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: '#4A9E5C' }}>CONNECTED</span>
            ) : (
              <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: '#CCCCCC' }}>NOT CONNECTED</span>
            )}
          </div>

          {!isConnected && (
            <div className="pl-4 space-y-1" style={{ borderLeft: '2px solid #E8E8E8' }}>
              <p className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: '#999999' }}>SETUP</p>
              <ol className="list-decimal list-inside space-y-1 font-mono" style={{ fontSize: 11, color: '#999999' }}>
                <li><a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" style={{ color: '#007AFF' }}>Slack API</a> でアプリを作成します</li>
                <li>"Incoming Webhooks"を有効化します</li>
                <li>Webhook URLをコピーして下記に貼り付けます</li>
              </ol>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="slack-webhook-url" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                WEBHOOK URL
              </label>
              <input
                id="slack-webhook-url"
                type="url"
                className="w-full px-3 py-2 font-mono text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="https://hooks.slack.com/services/..."
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...register('webhook_url')}
              />
              {errors.webhook_url && (
                <p className="font-mono mt-1" style={{ fontSize: 11, color: '#D71921' }}>
                  {errors.webhook_url.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="slack-channel-name" className="font-mono uppercase block" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999', marginBottom: 8 }}>
                CHANNEL
              </label>
              <input
                id="slack-channel-name"
                type="text"
                className="w-full px-3 py-2 font-mono text-sm outline-none transition-colors"
                style={{ border: 'none', borderBottom: '1px solid #CCCCCC', background: 'transparent', color: '#1A1A1A', borderRadius: 0 }}
                placeholder="#approvals"
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1A1A1A')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = '#CCCCCC')}
                {...register('channel_name')}
              />
              <p className="font-mono mt-1" style={{ fontSize: 11, color: '#CCCCCC' }}>
                SLACK CHANNEL FOR NOTIFICATIONS (E.G. #APPROVALS)
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: '#1A1A1A' }}>通知を有効にする</p>
                <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>
                  承認リクエスト発生時にSlackに通知します
                </p>
              </div>
              <Switch
                checked={watch('enabled')}
                onCheckedChange={(checked) => setValue('enabled', checked)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? '保存中...' : '設定を保存'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={testing || !watch('webhook_url')}
                onClick={handleTestNotification}
              >
                <Send className="h-4 w-4 mr-1" />
                {testing ? '送信中...' : 'テスト通知を送信'}
              </Button>
            </div>
          </form>
        </div>

        <WaitlistSection
          tenantId={tenant_id}
          channel="line_works"
          label="LINE WORKS"
          description="国内企業向けのLINE WORKS連携（承認/却下ボタン、監査ログ送信）を準備中です。"
          enrolled={Boolean(notifSettings?.line_works_waitlist)}
        />

        <WaitlistSection
          tenantId={tenant_id}
          channel="teams"
          label="Microsoft Teams"
          description="Teamsアダプティブカードによる承認・却下フローを準備中です。"
          enrolled={Boolean(notifSettings?.teams_waitlist)}
        />
      </div>
    </div>
  )
}

function WaitlistSection({
  tenantId,
  channel,
  label,
  description,
  enrolled,
}: {
  tenantId: string
  channel: 'line_works' | 'teams'
  label: string
  description: string
  enrolled: boolean
}) {
  const queryClient = useQueryClient()

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const waitlistPatch = channel === 'line_works'
        ? { line_works_waitlist: next, updated_at: new Date().toISOString() }
        : { teams_waitlist: next, updated_at: new Date().toISOString() }
      const waitlistInsert = {
        tenant_id: tenantId,
        line_works_waitlist: channel === 'line_works' ? next : false,
        teams_waitlist: channel === 'teams' ? next : false,
      }

      const { data: existing } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (existing) {
        const { error } = await supabase
          .from('notification_settings')
          .update(waitlistPatch)
          .eq('tenant_id', tenantId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('notification_settings')
          .insert(waitlistInsert)
        if (error) throw error
      }
    },
    onSuccess: (_, next) => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings', tenantId] })
      toast.success(next ? '事前登録しました。提供開始時にご連絡します。' : '事前登録を解除しました')
    },
    onError: () => toast.error('登録に失敗しました'),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#E8E8E8] pb-3">
        <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>{label} INTEGRATION</span>
        <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: '#CCCCCC' }}>COMING SOON</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="pr-4">
          <p className="text-sm" style={{ color: '#1A1A1A' }}>事前登録（Waitlist）</p>
          <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>{description}</p>
        </div>
        <Switch
          checked={enrolled}
          disabled={toggle.isPending}
          onCheckedChange={(checked) => toggle.mutate(checked)}
        />
      </div>
    </div>
  )
}
