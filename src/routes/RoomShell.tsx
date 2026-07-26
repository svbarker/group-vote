import type { ReactNode } from 'react'

// Shared mobile-first frame for every in-room screen (loading, lobby, voting,
// reveal) so phase transitions don't shift the layout out from under the user.
export function RoomShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 p-6">
      {children}
    </main>
  )
}
