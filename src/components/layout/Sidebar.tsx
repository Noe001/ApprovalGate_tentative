import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  LayoutDashboard, CheckSquare, Folder, Zap,
  BarChart2, Users, Settings, LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/enums'
import type { LucideIcon } from 'lucide-react'

interface SidebarProps {
  tenantId: string
  tenantName: string
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
  { to: '/t/$tenant_id/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { to: '/t/$tenant_id/approvals', label: 'APPROVALS', icon: CheckSquare, hasBadge: true },
  { to: '/t/$tenant_id/projects', label: 'PROJECTS', icon: Folder },
  { to: '/t/$tenant_id/rules', label: 'RULES', icon: Zap },
  { to: '/t/$tenant_id/analytics', label: 'ANALYTICS', icon: BarChart2 },
  { to: '/t/$tenant_id/team', label: 'TEAM', icon: Users },
  { to: '/t/$tenant_id/settings/general', label: 'SETTINGS', icon: Settings },
]

const approverNav: NavItem[] = [
  { to: '/t/$tenant_id/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { to: '/t/$tenant_id/approvals', label: 'APPROVALS', icon: CheckSquare, hasBadge: true },
  { to: '/t/$tenant_id/settings/account', label: 'ACCOUNT', icon: Settings },
]

const viewerNav: NavItem[] = [
  { to: '/t/$tenant_id/dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { to: '/t/$tenant_id/approvals', label: 'APPROVALS', icon: CheckSquare },
  { to: '/t/$tenant_id/analytics', label: 'ANALYTICS', icon: BarChart2 },
  { to: '/t/$tenant_id/settings/account', label: 'ACCOUNT', icon: Settings },
]

function getNavItems(role: UserRole): NavItem[] {
  if (role === 'approver') return approverNav
  if (role === 'viewer') return viewerNav
  return ownerAdminNav
}

export function Sidebar({ tenantId, tenantName, role, pendingCount = 0 }: Readonly<SidebarProps>) {
  const matchRoute = useMatchRoute()
  const nav = getNavItems(role)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    globalThis.location.href = '/login'
  }

  return (
    <aside
      className="hidden lg:flex flex-col h-screen fixed left-0 top-0"
      style={{ width: 240, background: '#FFFFFF', borderRight: '1px solid #E8E8E8' }}
    >
      {/* Header */}
      <div
        className="flex flex-col justify-center px-6 py-5"
        style={{ borderBottom: '1px solid #E8E8E8', minHeight: 64 }}
      >
        <p
          className="font-sans font-medium"
          style={{ fontSize: 13, color: '#000000', lineHeight: '1.2' }}
        >
          稟議ゲート（仮）
        </p>
        <p
          className="font-mono uppercase truncate mt-0.5"
          style={{ fontSize: 11, color: '#666666', letterSpacing: '0.08em', maxWidth: 176 }}
        >
          {tenantName}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {nav.map((item) => {
          const active = !!matchRoute({ to: item.to, params: { tenant_id: tenantId }, fuzzy: true })
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              params={{ tenant_id: tenantId }}
              className={cn(
                'flex items-center gap-3 px-6 py-3 transition-colors',
                'font-mono uppercase',
              )}
              style={{
                fontSize: 11,
                letterSpacing: '0.08em',
                background: active ? '#F0F0F0' : 'transparent',
                color: active ? '#000000' : '#999999',
                fontWeight: active ? 700 : 400,
              }}
            >
              <Icon
                className="shrink-0"
                style={{ width: 14, height: 14, color: active ? '#000000' : '#999999' }}
                strokeWidth={1.5}
              />
              <span className="flex-1">{item.label}</span>
              {item.hasBadge && pendingCount > 0 && (
                <span
                  className="font-mono text-center"
                  style={{
                    fontSize: 10,
                    background: '#D71921',
                    color: '#FFFFFF',
                    padding: '2px 6px',
                    minWidth: 20,
                    letterSpacing: '0.04em',
                  }}
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div style={{ borderTop: '1px solid #E8E8E8' }} className="py-3">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-6 py-3 w-full transition-colors font-mono uppercase"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            color: '#999999',
            background: 'transparent',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#666666' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#999999' }}
        >
          <LogOut style={{ width: 14, height: 14 }} strokeWidth={1.5} className="shrink-0" />
          SIGN OUT
        </button>
      </div>
    </aside>
  )
}
