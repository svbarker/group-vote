import { Label as ShadcnLabel } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

// Group Vote's Label. Wraps the shadcn primitive; consume this, never ui/label.
export type LabelProps = ComponentProps<typeof ShadcnLabel>

export function Label({ className, ...props }: LabelProps) {
  return (
    <ShadcnLabel className={cn('text-sm font-medium', className)} {...props} />
  )
}
