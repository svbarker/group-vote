import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/gv/button'

// Stub — built out in FE-2.2 (title, options toggle, createPoll -> lobby).
export function Create() {
  const navigate = useNavigate()
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Create a poll</h1>
      <p className="text-muted-foreground">Coming in FE-2.2.</p>
      <Button variant="outline" onClick={() => navigate('/')}>
        Back
      </Button>
    </main>
  )
}
