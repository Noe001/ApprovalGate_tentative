import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-[999px]',
    'font-mono text-[13px] uppercase tracking-[0.06em]',
    'min-h-[44px]',
    'transition-opacity duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    '[focus-visible:ring-color:var(--nd-text-display)]',
    'disabled:pointer-events-none disabled:opacity-40',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          '[background-color:#000000] [color:#F5F5F5]',
          'hover:opacity-80',
        ].join(' '),
        secondary: [
          'bg-transparent border border-[#CCCCCC] [color:#1A1A1A]',
          'hover:[background-color:#F0F0F0]',
        ].join(' '),
        ghost: [
          'bg-transparent border-0 [color:#666666]',
          'hover:[background-color:#F0F0F0] hover:[color:#1A1A1A]',
        ].join(' '),
        destructive: [
          'bg-transparent border border-[#D71921] [color:#D71921]',
          'hover:[background-color:rgba(215,25,33,0.08)]',
        ].join(' '),
        outline: [
          'bg-transparent border border-[#CCCCCC] [color:#1A1A1A]',
          'hover:[background-color:#F0F0F0]',
        ].join(' '),
        link: [
          'bg-transparent border-0 [color:#007AFF]',
          'underline-offset-4 hover:underline',
          'min-h-0',
        ].join(' '),
      },
      size: {
        default: 'h-11 px-6',
        sm: 'h-9 px-4 text-[12px]',
        lg: 'h-12 px-8',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
