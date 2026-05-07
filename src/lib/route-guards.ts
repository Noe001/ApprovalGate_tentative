import { notFound } from '@tanstack/react-router'
import type { UserRole } from '@/types/enums'

const ADMIN_ROLES: readonly UserRole[] = ['owner', 'admin']
const ANALYTICS_ROLES: readonly UserRole[] = ['owner', 'admin', 'viewer']

export function requireAdminRole(role: UserRole | undefined): void {
  requireRole(role, ADMIN_ROLES)
}

export function requireOwnerRole(role: UserRole | undefined): void {
  requireRole(role, ['owner'])
}

export function requireAnalyticsRole(role: UserRole | undefined): void {
  requireRole(role, ANALYTICS_ROLES)
}

function requireRole(role: UserRole | undefined, allowedRoles: readonly UserRole[]): void {
  if (!role || !allowedRoles.includes(role)) {
    throw notFound()
  }
}
