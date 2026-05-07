import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/button'
import { PLAN_LIMITS, type PlanType } from '@/types/enums'
import { requireOwnerRole } from '@/lib/route-guards'

const PLAN_DISPLAY_NAMES: Record<PlanType, string> = {
  starter: 'Starter',
  standard: 'Standard',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const PLAN_PRICES: Record<PlanType, string> = {
  starter: '¥15,000 / 月',
  standard: '¥50,000 / 月',
  pro: '¥150,000 / 月',
  enterprise: 'お問い合わせ',
}

interface PlanFeature {
  label: string
  starter: string
  standard: string
  pro: string
  enterprise: string
}

const PLAN_FEATURES: PlanFeature[] = [
  {
    label: 'プロジェクト数',
    starter: '1',
    standard: '5',
    pro: '20',
    enterprise: '無制限',
  },
  {
    label: 'メンバー数',
    starter: '5名',
    standard: '20名',
    pro: '100名',
    enterprise: '無制限',
  },
  {
    label: 'リクエスト数 / 月',
    starter: '100',
    standard: '1,000',
    pro: '10,000',
    enterprise: '無制限',
  },
  {
    label: 'Slack通知',
    starter: '✓',
    standard: '✓',
    pro: '✓',
    enterprise: '✓',
  },
  {
    label: 'アナリティクス',
    starter: '—',
    standard: '✓',
    pro: '✓',
    enterprise: '✓',
  },
  {
    label: 'SSO',
    starter: '—',
    standard: '—',
    pro: '—',
    enterprise: '✓',
  },
  {
    label: '優先サポート',
    starter: '—',
    standard: '✓',
    pro: '✓',
    enterprise: '専任サポート',
  },
  {
    label: 'SLA',
    starter: '—',
    standard: '—',
    pro: '—',
    enterprise: '✓',
  },
]

const PLAN_ORDER: PlanType[] = ['starter', 'standard', 'pro', 'enterprise']

export const Route = createFileRoute('/t/$tenant_id/settings/billing')({
  beforeLoad: ({ context }) => requireOwnerRole(context.role),
  component: BillingSettingsPage,
})

function BillingSettingsPage() {
  const { tenant_id } = Route.useParams()

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenant_id)
        .maybeSingle()
      return data
    },
  })

  const currentPlan: PlanType = subscription?.plan ?? 'starter'
  const limits = PLAN_LIMITS[currentPlan]
  const usagePercent =
    limits.requests > 0
      ? Math.min(
          100,
          Math.round(
            ((subscription?.current_period_requests ?? 0) / limits.requests) * 100
          )
        )
      : 0

  const handlePlanAction = (plan: PlanType) => {
    if (plan === currentPlan) return
    toast.info('プランの変更はお問い合わせください', {
      description: 'sales@ringigate.com までご連絡ください',
    })
  }

  const handleStripePortal = () => {
    toast.info('現在開発中です', {
      description: 'Stripeポータルは近日公開予定です',
    })
  }

  if (isLoading) {
    return (
      <div>
        <TopBar title="プラン・請求" />
        <div className="p-6 flex items-center justify-center h-48">
          <div className="text-sm text-gray-500">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <TopBar title="プラン・請求" />
      <div className="p-6 max-w-4xl space-y-10">
        {/* Current Plan */}
        <div className="space-y-5">
          <div className="border-b border-[#E8E8E8] pb-3">
            <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>現在のプラン</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="font-sans" style={{ fontSize: 36, lineHeight: 1.1, letterSpacing: '-0.02em', color: '#000000' }}>
                  {PLAN_DISPLAY_NAMES[currentPlan]}
                </span>
                <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#4A9E5C' }}>ACTIVE</span>
              </div>
              <p className="font-mono" style={{ fontSize: 14, color: '#999999' }}>{PLAN_PRICES[currentPlan]}</p>
              {subscription?.next_billing_date && (
                <p className="font-mono" style={{ fontSize: 11, color: '#CCCCCC' }}>
                  NEXT BILLING: {new Date(subscription.next_billing_date).toLocaleDateString('ja-JP')}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              {(() => {
                let usageColor = '#1A1A1A'
                if (usagePercent >= 90) usageColor = '#D71921'
                else if (usagePercent >= 70) usageColor = '#D4A843'
                const filled = Math.round((usagePercent / 100) * 20)
                return (
                  <>
                    <div className="flex justify-between mb-2">
                      <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>REQUESTS THIS MONTH</span>
                      <span className="font-mono" style={{ fontSize: 14, color: usageColor }}>
                        {(subscription?.current_period_requests ?? 0).toLocaleString()}
                        <span style={{ color: '#CCCCCC', fontSize: 11 }}>{limits.requests > 0 ? ` / ${limits.requests.toLocaleString()}` : ' / 無制限'}</span>
                      </span>
                    </div>
                    {limits.requests > 0 && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div key={`seg-${usagePercent}-${i}`} style={{ flex: 1, height: 8, background: i < filled ? usageColor : '#E8E8E8' }} />
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
            <div className="flex justify-between">
              <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>MEMBER LIMIT</span>
              <span className="font-mono" style={{ fontSize: 14, color: '#1A1A1A' }}>
                {limits.members === -1 ? '無制限' : `${limits.members}名`}
              </span>
            </div>
          </div>
        </div>

        {/* Plan Features */}
        <div className="space-y-5">
          <div className="border-b border-[#E8E8E8] pb-3">
            <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>プランの機能</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E8E8]">
                  <th className="text-left py-2 pr-4 font-mono uppercase w-40" style={{ fontSize: 10, letterSpacing: '0.08em', color: '#999999' }}>
                    FEATURE
                  </th>
                  {PLAN_ORDER.map((plan) => (
                    <th
                      key={plan}
                      className="text-center py-2 px-3"
                    >
                      <div className="font-sans" style={{ fontSize: 14, color: plan === currentPlan ? '#000000' : '#999999', fontWeight: plan === currentPlan ? 500 : 400 }}>{PLAN_DISPLAY_NAMES[plan]}</div>
                      {plan === currentPlan && (
                        <div className="font-mono uppercase mt-0.5" style={{ fontSize: 9, letterSpacing: '0.06em', color: '#4A9E5C' }}>
                          CURRENT
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {PLAN_FEATURES.map((feature) => (
                  <tr key={feature.label} className="hover:bg-[#F0F0F0] transition-colors">
                    <td className="py-3 pr-4 font-mono" style={{ fontSize: 12, color: '#999999' }}>{feature.label}</td>
                    {PLAN_ORDER.map((plan) => (
                      <td
                        key={plan}
                        className="text-center py-3 px-3"
                        style={{ background: plan === currentPlan ? '#F8F8F8' : 'transparent' }}
                      >
                        {(() => {
                          if (feature[plan] === '✓') return <span className="font-mono" style={{ fontSize: 12, color: '#4A9E5C' }}>✓</span>
                          if (feature[plan] === '—') return <span className="font-mono" style={{ color: '#CCCCCC' }}>—</span>
                          return <span className="font-mono" style={{ fontSize: 12, color: '#1A1A1A' }}>{feature[plan]}</span>
                        })()}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-[#E8E8E8]">
                  <td className="py-3 pr-4" />
                  {PLAN_ORDER.map((plan) => (
                    <td
                      key={plan}
                      className="text-center py-3 px-3"
                      style={{ background: plan === currentPlan ? '#F8F8F8' : 'transparent' }}
                    >
                      {plan === currentPlan ? (
                        <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.06em', color: '#4A9E5C' }}>
                          CURRENT
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={
                            PLAN_ORDER.indexOf(plan) >
                            PLAN_ORDER.indexOf(currentPlan)
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => handlePlanAction(plan)}
                          className="text-xs"
                        >
                          {PLAN_ORDER.indexOf(plan) >
                          PLAN_ORDER.indexOf(currentPlan)
                            ? 'アップグレード'
                            : 'ダウングレード'}
                        </Button>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Billing Info */}
        <div className="space-y-5">
          <div className="border-b border-[#E8E8E8] pb-3">
            <span className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.08em', color: '#999999' }}>請求先情報</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: '#1A1A1A' }}>
                Stripeカスタマーポータル
              </p>
              <p className="font-mono mt-0.5" style={{ fontSize: 11, color: '#999999' }}>
                請求書のダウンロード・支払い方法の変更
              </p>
            </div>
            <div className="relative group">
              <Button
                variant="outline"
                disabled
                onClick={handleStripePortal}
                className="gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Stripeポータルを開く
              </Button>
              <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block z-10">
                <div className="rounded px-2 py-1 whitespace-nowrap font-mono" style={{ background: '#1A1A1A', color: '#FFFFFF', fontSize: 11 }}>
                  現在開発中
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
