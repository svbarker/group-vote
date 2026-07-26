import { useNavigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { Trophy } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/gv/button'
import { cn } from '@/lib/utils'
import { getHostToken } from '@/lib/identity'
import { RoomShell } from './RoomShell'
import type { PollState } from './Room'

// The reveal screen: the room's shared payoff. Standings come from getResults
// (server-computed, reactive), so every client renders the same winner in
// lockstep the instant the host closes voting (PLAN §3, FE-5.1).
export function Reveal({ state, code }: { state: PollState; code: string }) {
  const navigate = useNavigate()
  const results = useQuery(api.polls.getResults, { code })
  const isHost = getHostToken(code) !== null

  const header = (
    <div className="space-y-2 text-center">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">
        Results · {state.poll.code}
      </p>
      <h1 className="text-xl font-semibold tracking-tight">
        {state.poll.title}
      </h1>
    </div>
  )

  // getResults briefly lags getPollState right after the phase flips.
  if (results === undefined || results === null) {
    return (
      <RoomShell>
        {header}
        <p className="text-muted-foreground text-center text-sm">
          Tallying the votes…
        </p>
      </RoomShell>
    )
  }

  const { standings, ballotCount } = results
  const topScore = standings[0]?.score ?? 0
  // A tie (or an all-zero result where nobody's #1 survived the cutoff) has no
  // single winner. topScore === 0 means every ballot rejected every option.
  const winners = standings.filter((s) => s.score === topScore)
  const hasWinner = topScore > 0 && winners.length === 1

  return (
    <RoomShell>
      {header}

      <section
        className="rounded-2xl border border-border bg-muted/40 p-5 text-center"
        aria-live="polite"
      >
        <Trophy className="text-primary mx-auto size-8" aria-hidden />
        {hasWinner ? (
          <>
            <p className="text-muted-foreground mt-2 text-xs tracking-wide uppercase">
              Winner
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {winners[0].text}
            </p>
          </>
        ) : topScore === 0 ? (
          <p className="mt-2 text-lg font-semibold">No clear winner</p>
        ) : (
          <>
            <p className="text-muted-foreground mt-2 text-xs tracking-wide uppercase">
              It's a tie
            </p>
            <p className="mt-1 text-lg font-semibold">
              {winners.map((w) => w.text).join(' · ')}
            </p>
          </>
        )}
        <p className="text-muted-foreground mt-3 text-sm">
          {ballotCount === 1 ? '1 ballot' : `${ballotCount} ballots`} counted
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-medium">
          Full standings
        </h2>
        <ol className="space-y-2">
          {standings.map((s, i) => (
            <ResultBar
              key={s.optionId}
              rank={i + 1}
              text={s.text}
              score={s.score}
              maxScore={topScore}
              isWinner={hasWinner && i === 0}
            />
          ))}
        </ol>
      </section>

      <div className="space-y-2">
        {isHost && (
          <Button className="w-full" onClick={() => navigate('/create')}>
            Start a new poll
          </Button>
        )}
        <Button
          variant={isHost ? 'ghost' : 'default'}
          className="w-full"
          onClick={() => navigate('/')}
        >
          Back to home
        </Button>
      </div>
    </RoomShell>
  )
}

// One standings row: rank, option text, and a bar whose length tracks the
// option's share of the winning score. Zero-score options still render a labeled
// (empty) bar so a "hard no across the board" reads clearly.
function ResultBar({
  rank,
  text,
  score,
  maxScore,
  isWinner,
}: {
  rank: number
  text: string
  score: number
  maxScore: number
  isWinner: boolean
}) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">
          <span className="text-muted-foreground tabular-nums">{rank}.</span>{' '}
          {text}
        </span>
        <span className="text-muted-foreground shrink-0 tabular-nums">
          {score}
        </span>
      </div>
      <div className="bg-muted h-2.5 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full',
            isWinner ? 'bg-primary' : 'bg-primary/50',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </li>
  )
}
