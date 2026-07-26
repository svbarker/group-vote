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

describe('advancePhase', () => {
  test('host opens voting (lobby → voting)', async () => {
    const t = setup()
    const { code, hostToken } = await hostAPoll(t)

    const { phase } = await t.mutation(api.polls.advancePhase, {
      code,
      hostToken,
    })
    expect(phase).toBe('voting')

    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.poll.phase).toBe('voting')
  })

  test('rejects a wrong host token', async () => {
    const t = setup()
    const { code } = await hostAPoll(t)
    await expect(
      t.mutation(api.polls.advancePhase, { code, hostToken: 'not-the-token' }),
    ).rejects.toThrow(/only the host/i)
  })

  test('will not advance past voting yet (revealed is M5)', async () => {
    const t = setup()
    const { code, hostToken } = await hostAPoll(t)
    await t.mutation(api.polls.advancePhase, { code, hostToken })
    await expect(
      t.mutation(api.polls.advancePhase, { code, hostToken }),
    ).rejects.toThrow(/cannot advance from the voting phase/i)
  })
})

describe('submitBallot', () => {
  // Open a poll with two seed options, advance to voting, and return the option ids.
  async function votingPoll(t: ReturnType<typeof setup>) {
    const { code, hostToken } = await hostAPoll(t, {
      seedOptions: ['Pizza', 'Tacos'],
    })
    await t.mutation(api.polls.advancePhase, { code, hostToken })
    const state = await t.query(api.polls.getPollState, { code })
    const [pizza, tacos] = state!.options.map((o) => o.id)
    return { code, pizza, tacos }
  }

  test('records a ballot and counts toward the vote tally', async () => {
    const t = setup()
    const { code, pizza, tacos } = await votingPoll(t)

    await t.mutation(api.polls.submitBallot, {
      code,
      userId: 'user-host',
      ranking: [pizza],
      rejected: [tacos],
    })

    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.ballotCount).toBe(1)
  })

  test('upsert: re-submitting overwrites the prior ballot', async () => {
    const t = setup()
    const { code, pizza, tacos } = await votingPoll(t)

    await t.mutation(api.polls.submitBallot, {
      code,
      userId: 'user-host',
      ranking: [pizza],
      rejected: [tacos],
    })
    await t.mutation(api.polls.submitBallot, {
      code,
      userId: 'user-host',
      ranking: [tacos, pizza],
      rejected: [],
    })

    const state = await t.query(api.polls.getPollState, { code })
    expect(state?.ballotCount).toBe(1) // one ballot, not two
  })

  test('rejects a ballot before voting is open', async () => {
    const t = setup()
    const { code } = await hostAPoll(t, { seedOptions: ['Pizza'] })
    const state = await t.query(api.polls.getPollState, { code })
    const pizza = state!.options[0].id
    await expect(
      t.mutation(api.polls.submitBallot, {
        code,
        userId: 'user-host',
        ranking: [pizza],
        rejected: [],
      }),
    ).rejects.toThrow(/voting is not open/i)
  })

  test('rejects an option that appears twice', async () => {
    const t = setup()
    const { code, pizza } = await votingPoll(t)
    await expect(
      t.mutation(api.polls.submitBallot, {
        code,
        userId: 'user-host',
        ranking: [pizza],
        rejected: [pizza],
      }),
    ).rejects.toThrow(/more than once/i)
  })

  test('rejects an option id from another poll', async () => {
    const t = setup()
    const { code } = await votingPoll(t)
    const other = await votingPoll(t)
    await expect(
      t.mutation(api.polls.submitBallot, {
        code,
        userId: 'user-host',
        ranking: [other.pizza],
        rejected: [],
      }),
    ).rejects.toThrow(/not in this poll/i)
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
