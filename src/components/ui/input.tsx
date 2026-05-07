import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full',
        'rounded-[8px] border border-[#CCCCCC]',
        'bg-transparent px-3 py-2',
        'font-mono text-sm [color:#1A1A1A]',
        'placeholder:[color:#999999]',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:[border-color:#000000]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
