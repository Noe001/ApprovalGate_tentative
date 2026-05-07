import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  [
    'inline-flex items-center',
    'rounded-[4px]',
    'border',
    'px-2 py-0.5',
    'font-mono text-[11px] uppercase tracking-[0.08em]',
    'bg-transparent',
    'transition-colors',
  ].join(' '),
  {
    variants: {
      variant: {
        default:   'border-[#CCCCCC] [color:#666666]',
        outline:   'border-[#CCCCCC] [color:#666666]',
        secondary: 'border-[#CCCCCC] [color:#666666]',
        success:   'border-[#4A9E5C] [color:#4A9E5C]',
        warning:   'border-[#D4A843] [color:#D4A843]',
        destructive: 'border-[#D71921] [color:#D71921]',
        info:      'border-[#007AFF] [color:#007AFF]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
