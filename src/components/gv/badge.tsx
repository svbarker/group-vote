import { Badge as ShadcnBadge } from '@/components/ui/badge'
import type { ComponentProps } from 'react'

// Group Vote's Badge. Wraps the shadcn primitive; consume this, never ui/badge.
export type BadgeProps = ComponentProps<typeof ShadcnBadge>

export function Badge(props: BadgeProps) {
  return <ShadcnBadge {...props} />
}
