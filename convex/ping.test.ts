// @vitest-environment edge-runtime
// Convex functions run in a V8 isolate, not Node — edge-runtime mirrors that so
// runtime-incompatible code fails here rather than in production. Only this file
// opts in; component tests keep the default jsdom environment.
import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api } from './_generated/api'

// convex-test loads the backend functions via Vite's import.meta.glob.
const modules = import.meta.glob('./**/*.*s')

test('ping returns ok with a server timestamp', async () => {
  const t = convexTest(undefined, modules)
  const result = await t.query(api.ping.ping, {})

  expect(result.ok).toBe(true)
  expect(typeof result.serverTime).toBe('number')
})
