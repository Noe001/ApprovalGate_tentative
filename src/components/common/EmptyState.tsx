import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

const DOT_MATRIX = '· · · · ·\n· · · · ·\n· · · · ·\n· · · · ·\n· · · · ·'

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center text-center', className)}
      style={{ paddingTop: 96, paddingBottom: 64 }}
    >
      {/* Dot-matrix decoration */}
      <pre
        className="font-mono select-none mb-8"
        style={{
          fontSize: 14,
          color: '#E8E8E8',
          lineHeight: '1.8',
          letterSpacing: '0.3em',
          whiteSpace: 'pre',
        }}
        aria-hidden="true"
      >
        {DOT_MATRIX}
      </pre>

      <h3
        className="font-sans"
        style={{ fontSize: 16, color: '#666666', marginBottom: 8 }}
      >
        {title}
      </h3>

      {description && (
        <p
          className="font-sans"
          style={{ fontSize: 14, color: '#999999', maxWidth: 320, marginBottom: 24 }}
        >
          {description}
        </p>
      )}

      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  )
}
