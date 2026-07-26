import { Button as ShadcnButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

// Group Vote's Button. Wraps the shadcn primitive so the whole app shares one
// button surface — mobile-first, so we default to a larger touch target than
// shadcn's compact default. Consume this across the app, never ui/button directly.
export type ButtonProps = ComponentProps<typeof ShadcnButton>

export function Button({ size = 'lg', className, ...props }: ButtonProps) {
  return (
    <ShadcnButton
      size={size}
      className={cn('min-h-11', className)}
      {...props}
    />
  )
}
