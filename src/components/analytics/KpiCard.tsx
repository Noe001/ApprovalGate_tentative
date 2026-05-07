import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface KpiCardProps {
  title: string
  value: string | number
  delta?: string
  deltaPositive?: boolean
  icon?: ReactNode
  description?: string
}

export function KpiCard({ title, value, delta, deltaPositive, description }: KpiCardProps) {
  return (
    <div>
      <span className="font-mono uppercase" style={{ fontSize: 10, color: '#AAAAAA', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>{title}</span>
      <div className="flex items-end gap-2 mb-1">
        <span className="font-mono" style={{ fontSize: 24, color: '#1A1A1A', lineHeight: 1, fontWeight: 400 }}>{value}</span>
        {delta !== undefined && (
          <span
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: '0.06em',
              padding: '2px 8px',
              borderRadius: 4,
              border: `1px solid ${deltaPositive ? '#4A9E5C' : '#D71921'}`,
              color: deltaPositive ? '#4A9E5C' : '#D71921',
              background: 'transparent',
              marginBottom: 2,
            }}
          >
            {deltaPositive ? '+' : ''}{delta}
          </span>
        )}
      </div>
      {description && (
        <p className="text-xs" style={{ color: '#BBBBBB', marginTop: 2 }}>{description}</p>
      )}
    </div>
  )
}
