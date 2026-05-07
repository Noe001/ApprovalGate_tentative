export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_APPROVED'
  | 'TIMED_OUT'
  | 'ERROR'

export type UserRole = 'owner' | 'admin' | 'approver' | 'viewer'

export type ActionType =
  | 'auto_approve'
  | 'notify_approver'
  | 'auto_reject'
  | 'escalate'

export type ApproverMode = 'any' | 'all'

export type TimeoutBehavior = 'deny' | 'allow'

export type AuditChannel = 'web' | 'slack' | 'line_works' | 'teams' | 'api' | 'system'

export type AuditActorType = 'user' | 'system'

export type PlanType = 'starter' | 'standard' | 'pro' | 'enterprise'

export const PLAN_LIMITS: Record<PlanType, { members: number; requests: number; price: number }> = {
  starter: { members: 5, requests: 100, price: 15000 },
  standard: { members: 20, requests: 1000, price: 50000 },
  pro: { members: 100, requests: 10000, price: 150000 },
  enterprise: { members: -1, requests: -1, price: 0 },
}

export const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: '承認待ち',
  APPROVED: '承認済み',
  REJECTED: '却下済み',
  AUTO_APPROVED: '自動承認',
  TIMED_OUT: 'タイムアウト',
  ERROR: 'エラー',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'オーナー',
  admin: '管理者',
  approver: '承認者',
  viewer: '閲覧者',
}

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  auto_approve: '自動承認',
  notify_approver: '承認者に通知',
  auto_reject: '自動却下',
  escalate: 'エスカレーション',
}
