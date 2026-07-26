// @vitest-environment edge-runtime
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from './roomCode'

const modules = import.meta.glob('./**/*.*s')

function setup() {
  return convexTest(schema, modules)
}

async function hostAPoll(
  t: ReturnType<typeof setup>,
  overrides: Partial<{
    allowUserOptions: boolean
    seedOptions: string[]
  }> = {},
) {
  return t.mutation(api.polls.createPoll, {
    title: 'Dinner spot',
    allowUserOptions: overrides.allowUserOptions ?? true,
    name: 'Host Hana',
    userId: 'user-host',
    seedOptions: overrides.seedOptions,
  })
}

describe('createPoll', () => {
  test('opens a lobby with the host as the first user', async () => {
    const t = setup()
    const { code, hostToken } = await hostAPoll(t)

    expect(code).toHaveLength(ROOM_CODE_LENGTH)
    for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch)
    expect(hostToken).toMatch(/[0-9a-f-]{36}/)

    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.poll.phase).toBe('lobby')
    expect(state?.users).toHaveLength(1)
    expect(state?.users[0]).toMatchObject({ name: 'Host Hana', isHost: true })
  })

  test('rejects an empty title', async () => {
    const t = setup()
    await expect(
      t.mutation(api.polls.createPoll, {
        title: '   ',
        allowUserOptions: false,
        name: 'Host Hana',
        userId: 'user-host',
      }),
    ).rejects.toThrow(/title is required/i)
  })

  test('seeds options, trimming blanks', async () => {
    const t = setup()
    const { code } = await hostAPoll(t, {
      seedOptions: ['Pizza', '  Tacos ', '   '],
    })

    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.options.map((o) => o.text)).toEqual(['Pizza', 'Tacos'])
  })
})

describe('addOption', () => {
  test('adds an option that shows up in poll state', async () => {
    const t = setup()
    const { code } = await hostAPoll(t)

    await t.mutation(api.polls.addOption, {
      code,
      text: 'Sushi',
      userId: 'user-host',
    })

    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.options.map((o) => o.text)).toContain('Sushi')
  })

  test('rejects a non-member', async () => {
    const t = setup()
    const { code } = await hostAPoll(t)
    await expect(
      t.mutation(api.polls.addOption, {
        code,
        text: 'Sushi',
        userId: 'stranger',
      }),
    ).rejects.toThrow(/join the room/i)
  })

  test('blocks a guest when allowUserOptions is off, but not the host', async () => {
    const t = setup()
    const { code } = await hostAPoll(t, { allowUserOptions: false })
    await t.mutation(api.polls.joinPoll, {
      code,
      name: 'Guest Gus',
      userId: 'user-guest',
    })

    await expect(
      t.mutation(api.polls.addOption, {
        code,
        text: 'Ramen',
        userId: 'user-guest',
      }),
    ).rejects.toThrow(/disabled adding options/i)

    // host is still allowed
    await t.mutation(api.polls.addOption, {
      code,
      text: 'Ramen',
      userId: 'user-host',
    })
    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.options.map((o) => o.text)).toEqual(['Ramen'])
  })

  test('rejects an empty option', async () => {
    const t = setup()
    const { code } = await hostAPoll(t)
    await expect(
      t.mutation(api.polls.addOption, {
        code,
        text: '   ',
        userId: 'user-host',
      }),
    ).rejects.toThrow(/required/i)
  })
})

describe('joinPoll', () => {
  test('rejects an unknown code', async () => {
    const t = setup()
    await expect(
      t.mutation(api.polls.joinPoll, {
        code: 'ZZZZ',
        name: 'Guest',
        userId: 'user-guest',
      }),
    ).rejects.toThrow(/No room found/i)
  })

  test('normalizes a lowercased code', async () => {
    const t = setup()
    const { code } = await hostAPoll(t)

    await t.mutation(api.polls.joinPoll, {
      code: code.toLowerCase(),
      name: 'Guest Gus',
      userId: 'user-guest',
    })

    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.users.map((u) => u.name)).toContain('Guest Gus')
  })

  test('is idempotent per userId: re-join updates the name, adds no row', async () => {
    const t = setup()
    const { code } = await hostAPoll(t)

    await t.mutation(api.polls.joinPoll, {
      code,
      name: 'Guest Gus',
      userId: 'user-guest',
    })
    await t.mutation(api.polls.joinPoll, {
      code,
      name: 'Gus Renamed',
      userId: 'user-guest',
    })

    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.users).toHaveLength(2) // host + one guest, not two guests
    expect(state?.users.find((u) => !u.isHost)?.name).toBe('Gus Renamed')
  })
})

describe('getPollState', () => {
  test('returns null for an unknown code', async () => {
    const t = setup()
    expect(await t.query(api.polls.getPollState, { code: 'ZZZZ' })).toBeNull()
  })

  test('never exposes the secret hostToken', async () => {
    const t = setup()
    const { code } = await hostAPoll(t)
    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.poll).not.toHaveProperty('hostToken')
  })
})
