import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Badge } from '@/components/gv/badge'
import { Button } from '@/components/gv/button'
import { Input } from '@/components/gv/input'
import { getHostToken, getUserId } from '@/lib/identity'

function LobbyShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 p-6">
      {children}
    </main>
  )
}

export function Lobby() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const state = useQuery(api.polls.getPollState, { code })
  const addOption = useMutation(api.polls.addOption)
  const myUserId = getUserId()
  const isHost = getHostToken(code) !== null

  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

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

  if (state === undefined) {
    return (
      <LobbyShell>
        <p className="text-center text-muted-foreground">Loading room…</p>
      </LobbyShell>
    )
  }

  if (state === null) {
    return (
      <LobbyShell>
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
      </LobbyShell>
    )
  }

  const { poll, users, options } = state
  const canAddOptions = poll.phase === 'lobby' && (poll.allowUserOptions || isHost)

  return (
    <LobbyShell>
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
        <p className="text-center text-sm text-muted-foreground">
          You&apos;re the host. Voting controls arrive next.
        </p>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          Waiting for the host to start voting…
        </p>
      )}

      <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
        Leave
      </Button>
    </LobbyShell>
  )
}
