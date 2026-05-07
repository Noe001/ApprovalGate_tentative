import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { cn } from '@/lib/utils/cn'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center',
      'rounded-[999px]',
      'border border-[#CCCCCC]',
      'transition-colors duration-200',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:[ring-color:#000000]',
      'disabled:cursor-not-allowed disabled:opacity-40',
      // Off state: transparent bg, visible border
      'data-[state=unchecked]:bg-transparent',
      // On state: black bg, no visible border change needed
      'data-[state=checked]:[background-color:#000000] data-[state=checked]:[border-color:#000000]',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-[16px] w-[16px]',
        'rounded-full',
        'transition-transform duration-200',
        'data-[state=checked]:translate-x-[19px] data-[state=unchecked]:translate-x-[2px]',
        // Off: grey thumb; On: white thumb
        'data-[state=unchecked]:[background-color:#CCCCCC]',
        'data-[state=checked]:[background-color:#FFFFFF]',
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
