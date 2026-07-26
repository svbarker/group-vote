import { Switch as ShadcnSwitch } from '@/components/ui/switch'
import type { ComponentProps } from 'react'

// Group Vote's Switch. Wraps the shadcn primitive; consume this, never ui/switch.
export type SwitchProps = ComponentProps<typeof ShadcnSwitch>

export function Switch(props: SwitchProps) {
  return <ShadcnSwitch {...props} />
}
