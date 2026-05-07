import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full',
          'rounded-[8px] border border-[#CCCCCC]',
          'bg-transparent px-3 py-2',
          'font-mono text-sm [color:#1A1A1A]',
          'placeholder:[color:#999999]',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:[border-color:#000000]',
          'disabled:cursor-not-allowed disabled:opacity-40',
          'resize-y',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
