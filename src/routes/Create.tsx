import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/gv/button'
import { Input } from '@/components/gv/input'
import { Label } from '@/components/gv/label'
import { Switch } from '@/components/gv/switch'
import {
  getSavedName,
  getUserId,
  saveHostToken,
  saveName,
} from '@/lib/identity'

export function Create() {
  const navigate = useNavigate()
  const createPoll = useMutation(api.polls.createPoll)

  const [title, setTitle] = useState('')
  const [name, setName] = useState(getSavedName)
  const [allowUserOptions, setAllowUserOptions] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canCreate =
    title.trim().length > 0 && name.trim().length > 0 && !submitting

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!canCreate) return
    setSubmitting(true)
    setError(null)
    try {
      const { code, hostToken } = await createPoll({
        title: title.trim(),
        allowUserOptions,
        name: name.trim(),
        userId: getUserId(),
      })
      saveHostToken(code, hostToken) // marks this device as the host of that room
      saveName(name)
      navigate(`/room/${code}`)
    } catch {
      setError('Could not create the poll — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 p-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create a poll</h1>
        <p className="text-muted-foreground text-sm">
          You&apos;ll get a room code to share.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="poll-title">What are we deciding?</Label>
          <Input
            id="poll-title"
            placeholder="e.g. Where should we eat?"
            autoComplete="off"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="host-name">Your name</Label>
          <Input
            id="host-name"
            placeholder="Your name"
            autoComplete="name"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="allow-options" className="font-normal">
            Let people add their own options
          </Label>
          <Switch
            id="allow-options"
            checked={allowUserOptions}
            onCheckedChange={setAllowUserOptions}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <Button type="submit" className="w-full" disabled={!canCreate}>
            {submitting ? 'Creating…' : 'Create poll'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => navigate('/')}
          >
            Back
          </Button>
        </div>
      </form>
    </main>
  )
}
