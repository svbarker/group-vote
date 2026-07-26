import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// See PLAN.md §4 for the full data model. M2 lands `polls` + `users`;
// M3 adds `options`; M4 adds `ballots`.
export default defineSchema({
  polls: defineTable({
    code: v.string(), // unambiguous room code, uppercased on store (PLAN §7)
    title: v.string(),
    phase: v.union(
      v.literal('lobby'),
      v.literal('voting'),
      v.literal('revealed'),
    ),
    scoringMethod: v.literal('borda'), // extensible: | 'irv' later
    allowUserOptions: v.boolean(),
    hostToken: v.string(), // secret; only the holder can advance phases
    createdAt: v.number(),
  }).index('by_code', ['code']),

  users: defineTable({
    pollId: v.id('polls'),
    userId: v.string(), // client-generated, from localStorage
    name: v.string(),
    isHost: v.boolean(),
    joinedAt: v.number(),
  }).index('by_poll', ['pollId']),

  options: defineTable({
    pollId: v.id('polls'),
    text: v.string(),
    addedByUserId: v.string(), // client userId of whoever suggested it
    createdAt: v.number(),
  }).index('by_poll', ['pollId']),

  // One ballot per user per poll. `ranking` is the ordered list ABOVE the cutoff
  // (index 0 = top choice); `rejected` is everything below the "hard no" line and
  // scores zero (PLAN §4, §6). `by_poll_user` backs the upsert on re-vote.
  ballots: defineTable({
    pollId: v.id('polls'),
    userId: v.string(),
    ranking: v.array(v.id('options')),
    rejected: v.array(v.id('options')),
    submittedAt: v.number(),
  })
    .index('by_poll', ['pollId'])
    .index('by_poll_user', ['pollId', 'userId']),
})
