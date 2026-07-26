import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/gv/button'

// Stub — built out in FE-2.3 (live getPollState: room code + user list).
export function Lobby() {
  const { code } = useParams()
  const navigate = useNavigate()
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6 text-center">
      <p className="text-muted-foreground text-sm">Room</p>
      <p className="text-4xl font-bold tracking-[0.3em] uppercase">{code}</p>
      <p className="text-muted-foreground">Lobby coming in FE-2.3.</p>
      <Button variant="outline" onClick={() => navigate('/')}>
        Leave
      </Button>
    </main>
  )
}
