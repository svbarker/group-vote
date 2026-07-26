import { query } from './_generated/server'

// Trivial end-to-end health check: proves the reactive query path works before
// any real features. `serverTime` comes from the Convex backend, not the client.
export const ping = query({
  args: {},
  handler: () => {
    return { ok: true as const, serverTime: Date.now() }
  },
})
