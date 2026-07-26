import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { generateRoomCode } from './roomCode'

// The room-code space is ~280k; collisions are rare, but retry a few times
// before giving up so a clash never surfaces to the user.
const MAX_CODE_ATTEMPTS = 5

// Server-side cap so a client can't stash unbounded text on the poll. The Create
// screen enforces a matching maxLength; this is the authoritative guard.
const MAX_OPTION_LENGTH = 100

function requireNonEmpty(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required.`)
  return trimmed
}

// Trim + length-cap an option's text. Returns null for blank input so callers
// can silently skip empty seed entries rather than error on them.
function normalizeOptionText(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.slice(0, MAX_OPTION_LENGTH)
}

// Host creates a poll and is added as the first (host) user. `userId` is the
// client's localStorage identity; `hostToken` is a server-minted secret the
// client stores locally and must present to advance phases later.
export const createPoll = mutation({
  args: {
    title: v.string(),
    allowUserOptions: v.boolean(),
    name: v.string(),
    userId: v.string(),
    seedOptions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const title = requireNonEmpty(args.title, 'Poll title')
    const name = requireNonEmpty(args.name, 'Display name')
    const seedTexts = (args.seedOptions ?? [])
      .map(normalizeOptionText)
      .filter((t): t is string => t !== null)

    let code: string | null = null
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const candidate = generateRoomCode()
      const clash = await ctx.db
        .query('polls')
        .withIndex('by_code', (q) => q.eq('code', candidate))
        .first()
      if (!clash) {
        code = candidate
        break
      }
    }
    if (code === null) {
      throw new Error('Could not allocate a room code, please try again.')
    }

    const hostToken = crypto.randomUUID()
    const now = Date.now()

    const pollId = await ctx.db.insert('polls', {
      code,
      title,
      phase: 'lobby',
      scoringMethod: 'borda',
      allowUserOptions: args.allowUserOptions,
      hostToken,
      createdAt: now,
    })

    await ctx.db.insert('users', {
      pollId,
      userId: args.userId,
      name,
      isHost: true,
      joinedAt: now,
    })

    for (const text of seedTexts) {
      await ctx.db.insert('options', {
        pollId,
        text,
        addedByUserId: args.userId,
        createdAt: now,
      })
    }

    return { code, hostToken, userId: args.userId }
  },
})

// A user joins an existing room by code. Idempotent per device: re-joining with
// the same userId updates the display name instead of creating a duplicate row.
export const joinPoll = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase()
    const name = requireNonEmpty(args.name, 'Display name')

    const poll = await ctx.db
      .query('polls')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first()
    if (!poll) throw new Error('No room found for that code.')

    const members = await ctx.db
      .query('users')
      .withIndex('by_poll', (q) => q.eq('pollId', poll._id))
      .collect()
    const existing = members.find((u) => u.userId === args.userId)

    if (existing) {
      await ctx.db.patch(existing._id, { name })
    } else {
      await ctx.db.insert('users', {
        pollId: poll._id,
        userId: args.userId,
        name,
        isHost: false,
        joinedAt: Date.now(),
      })
    }

    return { pollId: poll._id }
  },
})

// Suggest an option during the lobby/suggestion phase. Gated on the server, per
// CLAUDE.md: options can only be added while the poll is in `lobby`, and only the
// host may add when `allowUserOptions` is off. Membership is re-checked from the
// DB rather than trusted from the client.
export const addOption = mutation({
  args: {
    code: v.string(),
    text: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const text = normalizeOptionText(args.text)
    if (!text) throw new Error('Option text is required.')

    const code = args.code.trim().toUpperCase()
    const poll = await ctx.db
      .query('polls')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first()
    if (!poll) throw new Error('No room found for that code.')
    if (poll.phase !== 'lobby') {
      throw new Error('Options can only be added before voting starts.')
    }

    const members = await ctx.db
      .query('users')
      .withIndex('by_poll', (q) => q.eq('pollId', poll._id))
      .collect()
    const member = members.find((u) => u.userId === args.userId)
    if (!member) throw new Error('Join the room before adding options.')
    if (!poll.allowUserOptions && !member.isHost) {
      throw new Error('The host has disabled adding options.')
    }

    await ctx.db.insert('options', {
      pollId: poll._id,
      text,
      addedByUserId: args.userId,
      createdAt: Date.now(),
    })
  },
})

// Reactive query driving the lobby: poll meta (minus the secret hostToken),
// current phase, and the user list ordered by join time. Returns null for an
// unknown code so the UI can show "room not found" rather than error out.
export const getPollState = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase()
    const poll = await ctx.db
      .query('polls')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first()
    if (!poll) return null

    const users = await ctx.db
      .query('users')
      .withIndex('by_poll', (q) => q.eq('pollId', poll._id))
      .collect()

    const options = await ctx.db
      .query('options')
      .withIndex('by_poll', (q) => q.eq('pollId', poll._id))
      .collect()

    return {
      poll: {
        code: poll.code,
        title: poll.title,
        phase: poll.phase,
        allowUserOptions: poll.allowUserOptions,
        createdAt: poll.createdAt,
      },
      users: users
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((u) => ({
          userId: u.userId,
          name: u.name,
          isHost: u.isHost,
          joinedAt: u.joinedAt,
        })),
      options: options
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((o) => ({
          id: o._id,
          text: o.text,
          addedByUserId: o.addedByUserId,
          createdAt: o.createdAt,
        })),
    }
  },
})
