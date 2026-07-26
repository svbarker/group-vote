import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/gv/button'
import { Input } from '@/components/gv/input'
import { getSavedName, getUserId, saveName } from '@/lib/identity'
import { ROOM_CODE_LENGTH } from '../../convex/roomCode'

export function Home() {
  const navigate = useNavigate()
  const joinPoll = useMutation(api.polls.joinPoll)

  const [code, setCode] = useState('')
  const [name, setName] = useState(getSavedName)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canJoin =
    code.length === ROOM_CODE_LENGTH && name.trim().length > 0 && !submitting

  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (!canJoin) return
    setSubmitting(true)
    setError(null)
    try {
      await joinPoll({ code, name: name.trim(), userId: getUserId() })
      saveName(name)
      navigate(`/room/${code}`)
    } catch {
      // Server rejects unknown codes; keep the message friendly and generic.
      setError("Couldn't join — double-check the code and try again.")
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Group Vote</h1>
        <p className="text-muted-foreground">
          Real-time, no-login group ranking.
        </p>
      </div>

      <Button className="w-full" onClick={() => navigate('/create')}>
        Create a poll
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or join a room
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleJoin} className="space-y-3">
        <Input
          aria-label="Room code"
          placeholder="Room code"
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          maxLength={ROOM_CODE_LENGTH}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="text-center text-2xl font-semibold tracking-[0.3em] uppercase"
        />
        <Input
          aria-label="Your name"
          placeholder="Your name"
          autoComplete="name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="outline"
          className="w-full"
          disabled={!canJoin}
        >
          {submitting ? 'Joining…' : 'Join'}
        </Button>
      </form>
    </main>
  )
}
