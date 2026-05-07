import type { ApprovalStatus } from '@/types/enums'
import { cn } from '@/lib/utils/cn'

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDING: '#D4A843',
  APPROVED: '#4A9E5C',
  AUTO_APPROVED: '#007AFF',
  REJECTED: '#D71921',
  TIMED_OUT: '#999999',
  ERROR: '#D71921',
}

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: '保留中',
  APPROVED: '承認済み',
  AUTO_APPROVED: '自動承認',
  REJECTED: '拒否',
  TIMED_OUT: 'タイムアウト',
  ERROR: 'エラー',
}

interface StatusBadgeProps {
  status: ApprovalStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = STATUS_COLORS[status]
  return (
    <span
      className={cn('inline-flex items-center font-mono uppercase', className)}
      style={{
        fontSize: 10,
        letterSpacing: '0.08em',
        color,
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: '2px 8px',
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
