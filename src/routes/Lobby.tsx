import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Badge } from '@/components/gv/badge'
import { Button } from '@/components/gv/button'
import { Input } from '@/components/gv/input'
import { getHostToken, getUserId } from '@/lib/identity'
import { RoomShell } from './RoomShell'
import type { PollState } from './Room'

export function Lobby({ state, code }: { state: PollState; code: string }) {
  const navigate = useNavigate()
  const addOption = useMutation(api.polls.addOption)
  const advancePhase = useMutation(api.polls.advancePhase)
  const myUserId = getUserId()
  const hostToken = getHostToken(code)
  const isHost = hostToken !== null

  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const { poll, users, options } = state
  const canAddOptions =
    poll.phase === 'lobby' && (poll.allowUserOptions || isHost)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true)
    setAddError(null)
    try {
      await addOption({ code, text, userId: myUserId })
      setDraft('')
    } catch {
      setAddError('Could not add that option — please try again.')
    } finally {
      setAdding(false)
    }
  }

  async function handleStart() {
    if (!hostToken || starting) return
    setStarting(true)
    setStartError(null)
    try {
      await advancePhase({ code, hostToken })
      // Phase flips server-side; the reactive query swaps this screen for Voting.
    } catch {
      setStartError('Could not start voting — please try again.')
      setStarting(false)
    }
  }

  return (
    <RoomShell>
      <div className="space-y-3 text-center">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          Room code
        </p>
        <p className="text-5xl font-bold tracking-[0.3em] uppercase">
          {poll.code}
        </p>
        <h1 className="text-lg font-medium text-muted-foreground">
          {poll.title}
        </h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {users.length === 1 ? '1 person here' : `${users.length} people here`}
        </h2>
        <ul className="space-y-2">
          {users.map((user) => (
            <li
              key={user.userId}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5"
            >
              <span className="font-medium">{user.name}</span>
              <span className="flex gap-1.5">
                {user.userId === myUserId && (
                  <Badge variant="secondary">You</Badge>
                )}
                {user.isHost && <Badge variant="outline">Host</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {options.length === 1 ? '1 option' : `${options.length} options`}
        </h2>
        {options.length > 0 ? (
          <ul className="space-y-2">
            {options.map((option) => (
              <li
                key={option.id}
                className="rounded-lg border border-border px-3 py-2.5 font-medium"
              >
                {option.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No options yet
            {canAddOptions ? ' — add the first one below.' : '.'}
          </p>
        )}

        {canAddOptions && (
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                aria-label="Add an option"
                placeholder="Add an option…"
                autoComplete="off"
                maxLength={100}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type="submit" disabled={!draft.trim() || adding}>
                Add
              </Button>
            </div>
            {addError && (
              <p role="alert" className="text-sm text-destructive">
                {addError}
              </p>
            )}
          </form>
        )}
      </section>

      {isHost ? (
        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={handleStart}
            disabled={starting || options.length === 0}
          >
            {starting ? 'Starting…' : 'Start voting'}
          </Button>
          {options.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Add at least one option to start voting.
            </p>
          )}
          {startError && (
            <p role="alert" className="text-center text-sm text-destructive">
              {startError}
            </p>
          )}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for the host to start voting…
        </p>
      )}

      <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
        Leave
      </Button>
    </RoomShell>
  )
}
