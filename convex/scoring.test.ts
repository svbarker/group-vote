import { describe, expect, test } from 'vitest'
import { score, type Ballot } from './scoring'

// Options are always passed in createdAt order (that's what getResults does),
// so tie-breaks fall through to this order last.
const OPTIONS = ['a', 'b', 'c']

// Convenience: score with Borda and return a plain id -> score map.
function scoreMap(ballots: Ballot[], optionIds = OPTIONS) {
  return new Map(
    score(ballots, optionIds, 'borda').map((s) => [s.optionId, s.score]),
  )
}

describe('score (Borda + cutoff)', () => {
  test('top choice earns N-1 regardless of how deep the ballot ranks', () => {
    // Ballot ranks only its top pick; the other two are rejected.
    const s = scoreMap([{ ranking: ['a'], rejected: ['b', 'c'] }])
    expect(s.get('a')).toBe(2) // N-1 with N=3
    expect(s.get('b')).toBe(0)
    expect(s.get('c')).toBe(0)
  })

  test('a full ranking hands out N-1, N-2, … down the list', () => {
    const s = scoreMap([{ ranking: ['a', 'b', 'c'], rejected: [] }])
    expect(s.get('a')).toBe(2)
    expect(s.get('b')).toBe(1)
    expect(s.get('c')).toBe(0)
  })

  test('rejected options score zero even when others rank them high', () => {
    const s = scoreMap([
      { ranking: ['a', 'b', 'c'], rejected: [] },
      { ranking: ['b'], rejected: ['a', 'c'] }, // hard-no on a and c
    ])
    // a: 2 + 0, b: 1 + 2, c: 0 + 0
    expect(s.get('a')).toBe(2)
    expect(s.get('b')).toBe(3)
    expect(s.get('c')).toBe(0)
  })

  test('sums across ballots and sorts best-first', () => {
    const standings = score(
      [
        { ranking: ['a', 'b', 'c'], rejected: [] },
        { ranking: ['b', 'a', 'c'], rejected: [] },
        { ranking: ['b', 'c', 'a'], rejected: [] },
      ],
      OPTIONS,
      'borda',
    )
    // a: 2+1+0=3, b: 1+2+2=5, c: 0+0+1=1
    expect(standings.map((x) => x.optionId)).toEqual(['b', 'a', 'c'])
    expect(standings[0]).toMatchObject({
      optionId: 'b',
      score: 5,
      firstPlaceVotes: 2,
    })
  })

  test('all-rejected ballot contributes nothing', () => {
    const s = scoreMap([{ ranking: [], rejected: ['a', 'b', 'c'] }])
    expect([...s.values()]).toEqual([0, 0, 0])
  })

  test('single ballot decides the ranking', () => {
    const standings = score(
      [{ ranking: ['c', 'a'], rejected: ['b'] }],
      OPTIONS,
      'borda',
    )
    expect(standings.map((x) => x.optionId)).toEqual(['c', 'a', 'b'])
  })

  test('no ballots leaves every option at zero, in createdAt order', () => {
    const standings = score([], OPTIONS, 'borda')
    expect(standings.map((x) => x.optionId)).toEqual(['a', 'b', 'c'])
    expect(standings.every((x) => x.score === 0)).toBe(true)
  })

  test('a score tie breaks on first-place votes', () => {
    // a and b both total 2, but a was ranked first once and b never is.
    const standings = score(
      [
        { ranking: ['a', 'c'], rejected: ['b'] }, // a:2, c:1
        { ranking: ['b', 'c'], rejected: ['a'] }, // b:2, c:1
        { ranking: ['c'], rejected: ['a', 'b'] }, // c:2
      ],
      OPTIONS,
      'borda',
    )
    // a:2 b:2 c:4 → c first; a and b tie on 2, a wins the tie on first-place votes
    const [first, second, third] = standings
    expect(first.optionId).toBe('c')
    expect(second.optionId).toBe('a')
    expect(third.optionId).toBe('b')
  })

  test('a total tie falls back to createdAt (optionIds order)', () => {
    // Symmetric ballots: a and b each score 2 with one first-place vote apiece.
    const standings = score(
      [
        { ranking: ['a', 'b'], rejected: [] },
        { ranking: ['b', 'a'], rejected: [] },
      ],
      ['a', 'b'],
      'borda',
    )
    expect(standings.map((x) => x.optionId)).toEqual(['a', 'b'])
  })

  test('ignores ids not belonging to the poll', () => {
    const s = scoreMap([{ ranking: ['a', 'ghost', 'b'], rejected: [] }])
    // ghost is dropped; b still sits at rank index 2 → N-1-2 = 0
    expect(s.get('a')).toBe(2)
    expect(s.get('b')).toBe(0)
    expect(s.has('ghost')).toBe(false)
  })
})
