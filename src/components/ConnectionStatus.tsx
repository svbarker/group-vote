import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

// M1 checkpoint scaffolding: proves the reactive query path is live end-to-end.
// useQuery returns undefined until the first server result arrives.
export function ConnectionStatus() {
  const ping = useQuery(api.ping.ping)

  if (ping === undefined) {
    return (
      <p className="text-muted-foreground text-sm">Connecting to Convex…</p>
    )
  }

  return (
    <p className="text-muted-foreground text-sm">
      Backend live · server time {new Date(ping.serverTime).toLocaleTimeString()}
    </p>
  )
}
