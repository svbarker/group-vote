import { Button } from '@/components/gv/button'
import { ConnectionStatus } from '@/components/ConnectionStatus'

function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Group Vote</h1>
        <p className="text-muted-foreground">
          Real-time, no-login group ranking.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button>Create a poll</Button>
        <Button variant="outline">Join with a code</Button>
      </div>
      <ConnectionStatus />
    </main>
  )
}

export default App
