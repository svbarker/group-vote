import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/gv/button'
import { RoomShell } from './RoomShell'
import { Lobby } from './Lobby'
import { Voting } from './Voting'
import { Reveal } from './Reveal'

// The non-null shape of getPollState — the single source of truth each in-room
// screen renders from. Derived from the query so the type can't drift.
export type PollState = NonNullable<
  FunctionReturnType<typeof api.polls.getPollState>
>

// One URL per room (`/room/:code`); the poll's `phase` decides which screen shows.
// Every client subscribes to the same reactive query, so when the host advances
// the phase the whole room switches in lockstep (PLAN §3, FE-4.1).
export function Room() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const state = useQuery(api.polls.getPollState, { code })

  if (state === undefined) {
    return (
      <RoomShell>
        <p className="text-muted-foreground text-center">Loading room…</p>
      </RoomShell>
    )
  }

  if (state === null) {
    return (
      <RoomShell>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Room not found
          </h1>
          <p className="text-muted-foreground text-sm">
            No room with code{' '}
            <span className="font-semibold uppercase">{code}</span>.
          </p>
        </div>
        <Button className="w-full" onClick={() => navigate('/')}>
          Back to home
        </Button>
      </RoomShell>
    )
  }

  switch (state.poll.phase) {
    case 'lobby':
      return <Lobby state={state} code={code} />
    case 'voting':
      return <Voting state={state} code={code} />
    case 'revealed':
      return <Reveal state={state} code={code} />
  }
}
