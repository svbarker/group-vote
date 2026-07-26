// Pure scoring (PLAN §6). Kept free of Convex/DB types so it's trivially
// unit-testable and swappable: Borda ships now; IRV drops in behind the same
// `score()` signature with no schema or API change.

export type ScoringMethod = 'borda'

// One voter's ballot: `ranking` is the ordered above-cutoff list (index 0 = top
// choice); `rejected` (below the "hard no" line) always scores zero. Any option
// absent from both lists is treated as unranked — also zero.
export type Ballot = {
  ranking: string[]
  rejected: string[]
}

export type Standing = {
  optionId: string
  score: number
  firstPlaceVotes: number
}

// Borda with a hard-no cutoff. N = total options in the poll; an above-line
// option at rank i earns N-1-i, so a voter's #1 always contributes exactly N-1
// regardless of how deep they ranked. Rejected/unranked options earn nothing.
function scoreBorda(ballots: Ballot[], optionIds: string[]): Standing[] {
  const n = optionIds.length
  const scores = new Map(optionIds.map((id) => [id, 0]))
  const firsts = new Map(optionIds.map((id) => [id, 0]))

  for (const ballot of ballots) {
    ballot.ranking.forEach((id, i) => {
      // Ignore ids not in the poll — the server validates ballots, but the pure
      // function stays defensive so a stray id can't corrupt the tally.
      if (!scores.has(id)) return
      scores.set(id, scores.get(id)! + (n - 1 - i))
      if (i === 0) firsts.set(id, firsts.get(id)! + 1)
    })
  }

  return optionIds.map((id) => ({
    optionId: id,
    score: scores.get(id)!,
    firstPlaceVotes: firsts.get(id)!,
  }))
}

// Standings sorted best-first. Ties break by first-place votes, then by the
// order of `optionIds` — callers pass options in `createdAt` order, so a full
// tie falls back to who was added first (PLAN §6), relying on a stable sort.
export function score(
  ballots: Ballot[],
  optionIds: string[],
  method: ScoringMethod,
): Standing[] {
  const standings = (() => {
    switch (method) {
      case 'borda':
        return scoreBorda(ballots, optionIds)
    }
  })()

  return standings.sort(
    (a, b) => b.score - a.score || b.firstPlaceVotes - a.firstPlaceVotes,
  )
}
