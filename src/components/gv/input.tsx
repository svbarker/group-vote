import { Input as ShadcnInput } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

// Group Vote's Input. Wraps the shadcn primitive with a larger, mobile-first
// touch target (matches the Button's min-h-11). Consume this, never ui/input.
export type InputProps = ComponentProps<typeof ShadcnInput>

export function Input({ className, ...props }: InputProps) {
  return <ShadcnInput className={cn('min-h-11', className)} {...props} />
}
