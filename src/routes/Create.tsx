import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { X } from 'lucide-react'
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
  const [seedOptions, setSeedOptions] = useState<string[]>([])
  const [allowUserOptions, setAllowUserOptions] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canCreate =
    title.trim().length > 0 && name.trim().length > 0 && !submitting

  function updateSeed(index: number, value: string) {
    setSeedOptions((prev) => prev.map((o, i) => (i === index ? value : o)))
  }

  function removeSeed(index: number) {
    setSeedOptions((prev) => prev.filter((_, i) => i !== index))
  }

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
        seedOptions: seedOptions.map((o) => o.trim()).filter(Boolean),
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

        <div className="space-y-2">
          <Label>Options to start with (optional)</Label>
          {seedOptions.length > 0 && (
            <ul className="space-y-2">
              {seedOptions.map((option, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Input
                    aria-label={`Option ${index + 1}`}
                    placeholder={`Option ${index + 1}`}
                    autoComplete="off"
                    maxLength={100}
                    value={option}
                    onChange={(e) => updateSeed(index, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() => removeSeed(index)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setSeedOptions((prev) => [...prev, ''])}
          >
            Add an option
          </Button>
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
