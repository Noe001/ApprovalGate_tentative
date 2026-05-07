import { Link, useMatchRoute } from '@tanstack/react-router'
import { LayoutDashboard, CheckSquare, Folder, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { UserRole } from '@/types/enums'
import type { LucideIcon } from 'lucide-react'

interface BottomNavProps {
  tenantId: string
  role: UserRole
  pendingCount?: number
}

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  hasBadge?: boolean
}

const ownerAdminNav: NavItem[] = [
  { to: '/t/$tenant_id/dashboard', label: 'HOME', icon: LayoutDashboard },
  { to: '/t/$tenant_id/approvals', label: 'APPROVALS', icon: CheckSquare, hasBadge: true },
  { to: '/t/$tenant_id/projects', label: 'PROJECTS', icon: Folder },
  { to: '/t/$tenant_id/analytics', label: 'ANALYTICS', icon: BarChart2 },
  { to: '/t/$tenant_id/settings/general', label: 'SETTINGS', icon: Settings },
]

const approverNav: NavItem[] = [
  { to: '/t/$tenant_id/dashboard', label: 'HOME', icon: LayoutDashboard },
  { to: '/t/$tenant_id/approvals', label: 'APPROVALS', icon: CheckSquare, hasBadge: true },
  { to: '/t/$tenant_id/settings/account', label: 'ACCOUNT', icon: Settings },
]

const viewerNav: NavItem[] = [
  { to: '/t/$tenant_id/dashboard', label: 'HOME', icon: LayoutDashboard },
  { to: '/t/$tenant_id/approvals', label: 'APPROVALS', icon: CheckSquare },
  { to: '/t/$tenant_id/analytics', label: 'ANALYTICS', icon: BarChart2 },
  { to: '/t/$tenant_id/settings/account', label: 'ACCOUNT', icon: Settings },
]

function getNavItems(role: UserRole): NavItem[] {
  if (role === 'approver') return approverNav
  if (role === 'viewer') return viewerNav
  return ownerAdminNav
}

export function BottomNav({ tenantId, role, pendingCount = 0 }: Readonly<BottomNavProps>) {
  const matchRoute = useMatchRoute()
  const navItems = getNavItems(role)

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-10"
      style={{ background: '#FFFFFF', borderTop: '1px solid #E8E8E8' }}
    >
      <div className="flex">
        {navItems.map((item) => {
          const active = !!matchRoute({ to: item.to, params: { tenant_id: tenantId }, fuzzy: true })
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              params={{ tenant_id: tenantId }}
              className={cn('flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors')}
              style={{ color: active ? '#000000' : '#999999' }}
            >
              <div className="relative">
                <Icon style={{ width: 18, height: 18 }} strokeWidth={1.5} />
                {item.hasBadge && pendingCount > 0 && (
                  <span
                    className="absolute font-mono flex items-center justify-center"
                    style={{
                      top: -4,
                      right: -6,
                      width: 14,
                      height: 14,
                      fontSize: 8,
                      background: '#D71921',
                      color: '#FFFFFF',
                    }}
                  >
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </div>
              <span
                className="font-mono uppercase"
                style={{ fontSize: 9, letterSpacing: '0.06em' }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
