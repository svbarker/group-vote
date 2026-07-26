# Group Vote — Plan

A no-login, real-time group ranking app. A host creates a poll, users join with a
Jackbox-style room code, everyone (optionally) adds options, then drags them into ranked
order. Ballots are scored and the winner is revealed live to the whole room.

**Mobile-first**: users join and vote on their phones, Jackbox-style. Design the user-facing
screens for small touch surfaces first, then scale up.

---

## 0. Status & start here

- **As of 2026-07-26:** M1 **frontend foundation + Convex backend done** — FE-1.1, QA-1.1, QA-1.2,
  **BE-1.1, BE-1.2, QA-1.3** complete (Vite+React+TS scaffold, Tailwind v4 + shadcn,
  ESLint/Prettier/tsc, Vitest+RTL; Convex initialized on a **cloud dev deployment** with a `ping`
  query + `convex-test`). `pnpm check` is green. Not yet committed. See M1 checklist below.
- **Next step:** M1 / **Chunk C** — **FE-1.2** wire `ConvexProvider` + render live `ping`, then
  **QA-1.4** GitHub Actions CI. Note: `pnpm typecheck` does **not** yet cover `convex/` (see below).
- **Read first:** this file (design + milestones) and `group-vote/CLAUDE.md` (conventions:
  pnpm-only, shadcn wrapper design system, quality gate, Convex rules, scope discipline).
- **Prerequisites before M1:**
  - Node + **pnpm** (`corepack enable` or `npm i -g pnpm`).
  - A **free Convex account** for the dev deployment — or plan to use `pnpm convex dev --local`.
- **Working style (see personal + project CLAUDE.md):** bite-sized, reviewable steps; pause for
  review at each sub-milestone; explain concepts in the unfamiliar areas (Convex, Vite, Vercel, pnpm).

---

## 1. Concept & core loop

1. **Host** creates a poll (title + optional seed options) → gets a 4-letter room code.
2. **Users** open the app, enter the code + a display name → land in the room lobby.
3. **Lobby / suggestion phase** — host and users can add candidate options in real time.
4. Host **starts voting** → each user drags options into ranked order, placing a
   **"hard no" cutoff line**; anything below the line scores zero. Users can change their
   ballot freely until voting closes.
5. Host **ends voting** → ballots are scored (Borda) and the **winner is revealed** to all
   users simultaneously, with a live results breakdown.

No accounts. Identity is a per-device `userId` (generated, stored in `localStorage`) plus a
display name. The host is just the user who created the poll (host token stored locally).

---

## 2. Tech stack (decided)

| Concern | Choice | Why |
|---|---|---|
| Frontend | **Vite + React + TypeScript** | Ephemeral app, no SSR needed; deploys anywhere |
| Backend / real-time | **Convex** | Reactive queries push live updates with no WebSocket plumbing; end-to-end TS; persistence + one-command deploy |
| Drag-to-rank | **dnd-kit** | Modern, accessible, TS-first, strong touch support |
| UI | **Tailwind CSS + shadcn/ui** | Fast path to a polished, mobile-first portfolio look |
| Room codes | **nanoid** (custom alphabet) | Short, unambiguous codes |
| Validation | **Zod** | Shared input validation |
| Hosting | Frontend on **Vercel/Netlify**, backend on **Convex** | Free tiers, trivial deploy |

**Alternative considered:** PartyKit (room-per-poll on Durable Objects) — more visibly shows
real-time architecture but requires hand-building the message protocol and persistence.
Convex chosen for reliability and clean full-stack TS.

---

## 2.5 Quality tooling

Set up in M1 so every feature ships behind the same gates.

| Concern | Tool | Notes |
|---|---|---|
| Typecheck | `tsc --noEmit` | Covers app + Convex-generated types |
| Lint | **ESLint** (flat config) + `typescript-eslint` + `eslint-plugin-react-hooks` | |
| Format | **Prettier** | Single source of formatting truth; ESLint stays out of style |
| Unit/component test | **Vitest** + **React Testing Library** | Vitest shares Vite config |
| Convex fn test | **`convex-test`** | Test mutations/queries against an in-memory Convex |
| CI | **GitHub Actions** | Runs typecheck + lint + test on push/PR |
| (Optional) pre-commit | **Husky** + **lint-staged** | Fast local guard before CI |

**Root scripts:** `typecheck`, `lint`, `format`, `test`, `test:watch`, and a `check` that runs
typecheck + lint + test together (what CI calls).

**Testing focus (not 100% coverage):**
- **Pure logic** — `score()` and room-code generation get thorough unit tests (edge cases:
  cutoff at top/bottom, ties, single ballot, all-rejected).
- **Convex functions** — happy path + guards (wrong phase, non-host advancing, bad code).
- **Components** — the ranking interaction and phase-driven routing; skip trivial presentational bits.
- **(Stretch)** Playwright E2E for the multi-client happy path — powerful for a real-time app,
  but heavier; deferred to M6/M7.

---

## 3. Real-time architecture

Convex reactive queries do the heavy lifting. Each screen subscribes to a query keyed by
`pollId`; any mutation that touches that poll's data causes all subscribers to re-render
automatically.

- `getPollState(code)` → poll meta + phase + user list + options (drives lobby & voting).
- `getResults(pollId)` → computed standings (drives the reveal).

Phase is a single source of truth on the poll document, so every client's UI switches in
lockstep when the host advances the poll.

---

## 4. Data model (Convex schema)

```ts
// convex/schema.ts
polls: {
  code: string,            // "WXYZ" — indexed, unique
  title: string,
  phase: "lobby" | "voting" | "revealed",
  scoringMethod: "borda",  // extensible: | "irv" later
  allowUserOptions: boolean,
  hostToken: string,       // secret; only the holder can advance phases
  createdAt: number,
}

users: {
  pollId: Id<"polls">,
  userId: string,          // client-generated, from localStorage
  name: string,
  isHost: boolean,
  joinedAt: number,
}

options: {
  pollId: Id<"polls">,
  text: string,
  addedByUserId: string,
  createdAt: number,
}

ballots: {
  pollId: Id<"polls">,
  userId: string,
  ranking: Id<"options">[],   // ordered, ABOVE the cutoff (top = most preferred)
  rejected: Id<"options">[],  // BELOW the cutoff / "hard no" → score 0
  submittedAt: number,
}
```

Indexes: `polls.by_code`, `users.by_poll`, `options.by_poll`, `ballots.by_poll`,
`ballots.by_poll_user` (upsert on re-submit — users can revise their ballot until voting closes).

**Why store both `ranking` and `rejected`:** the full-preference-plus-cutoff shape is rich
enough to feed instant-runoff later without a migration. Below-the-line options are a
truncated ballot — exactly what IRV expects.

---

## 5. Backend functions

**Mutations**
- `createPoll({ title, seedOptions, allowUserOptions })` → `{ code, hostToken, userId }`
- `joinPoll({ code, name, userId })` → `{ pollId }`
- `addOption({ code, text, userId })` — allowed in lobby; gated by `allowUserOptions`
- `submitBallot({ code, userId, ranking, rejected })` — upsert; allowed only in `voting`
- `advancePhase({ code, hostToken })` — lobby → voting → revealed (host only)

**Queries (reactive)**
- `getPollState({ code })` — poll meta, phase, users, options
- `getResults({ pollId })` — standings; only meaningful in `revealed` (see §6)

All inputs validated with Zod; server re-checks phase and host token — never trust the client.

---

## 6. Scoring — Borda with a "hard no" cutoff

Let **N** = total options in the poll. For one ballot with an above-line list `ranking` of
length *m* (index 0 = top):

```
points(option at index i) = N - 1 - i      // top gets N-1, next N-2, …
points(any rejected / below-line option) = 0
```

A poll's standings = sum of points per option across all ballots, sorted descending.
Ties broken by count of first-place ranks, then option `createdAt`.

**Why this scheme:** a voter's #1 always contributes exactly `N-1` regardless of how many
options they bother to rank, so top-choice weight is consistent across voters. The cutoff
line simply zeroes the tail instead of handing out consolation points — that's the whole
point of a "hard no."

**Keep it swappable (IRV-ready):** implement scoring as one pure function

```ts
type Ballot = { ranking: string[]; rejected: string[] };
type Standing = { optionId: string; score: number; firstPlaceVotes: number };
function score(ballots: Ballot[], optionIds: string[], method: ScoringMethod): Standing[]
```

`method` switches implementation. Borda ships first; IRV (eliminate lowest, redistribute,
repeat) drops in behind the same signature with no schema or API change.

---

## 7. Room codes

- Alphabet excludes ambiguous chars: no `O/0`, `I/1`, `L`. e.g. `ABCDEFGHJKMNPQRSTUVWXYZ`.
- 4 chars → ~230k combinations; plenty for concurrent live rooms.
- Generate, check `polls.by_code` for an active collision, retry on the rare clash.
- Codes are case-insensitive on input, uppercased on store.
- (Stretch) expire/reap polls after N hours so codes recycle.

---

## 8. Screens (mobile-first)

- **Home** — Create poll · Join with code.
- **Create** — title, optional seed options, "let users add options" toggle.
- **Lobby** — room code (big), user list, live option list, add-option box; host sees "Start voting".
- **Voting** — dnd-kit ranking surface with a draggable **cutoff line**; "Submit"; live "X of Y voted".
  Users can re-order and re-submit until the host closes voting.
- **Reveal** — winner spotlight + ranked results bar chart; host sees "New round / new poll".

Player-facing screens (Join, Lobby, Voting, Reveal) are designed phone-first; the Create/host
views can lean into more screen real estate on larger displays.

---

## 9. Build milestones

Each milestone is a **vertical slice** that ends in a runnable app. Within a milestone,
back-end (**BE**) sub-tasks land the data/functions first; front-end (**FE**) sub-tasks
consume them. 🟢 marks a **showable checkpoint** — a state you could demo or screenshot.

### M1 — Scaffold & pipeline
Goal: prove the full stack talks end to end **locally**, behind quality gates, before any features.
Full production hosting is deferred to M7 — everything M1–M6 runs on the Vite dev server +
Convex dev deployment (`pnpm convex dev`, optionally `--local`).

**Setup notes / deviations (as built):**
- Versions: Vite 8, React 19, TS 6, Tailwind **v4** (CSS-first via `@tailwindcss/vite`, no
  `tailwind.config`), shadcn **Nova** preset (Radix primitives + Lucide + Geist font).
- Swapped the Vite template's default **oxlint → ESLint** flat config (per §2.5).
- Path alias `@/* → src/*` (tsconfig + Vite). `strict: true` enabled.
- Design system: `src/components/gv/*` wrappers wrap `src/components/ui/*` (vendored shadcn);
  **app code imports `gv/` only, never `ui/` directly.** Wrap primitives lazily, as screens need them.
- Scripts: `dev build typecheck lint format format:check test test:watch check` (`check` = quality gate).

- ✅ **FE-1.1** Vite + React + TS project; Tailwind + shadcn configured.
- ✅ **QA-1.1** ESLint (flat) + Prettier + `tsc --noEmit`; root scripts (`lint`/`format`/`typecheck`).
- ✅ **QA-1.2** Vitest + RTL wired; a trivial passing test. Add `test`/`test:watch`/`check` scripts.
- ✅ **BE-1.1** Init Convex; add a trivial `ping` query returning a timestamp.
- ✅ **BE-1.2** Wire dev deployment (cloud); confirmed `pnpm convex dev` regenerates types.
- ✅ **QA-1.3** `convex-test` wired; sample `ping` test passes (edge-runtime env, per-file).
- **FE-1.2** `ConvexProvider` wired; a component renders live `ping` data.
- **QA-1.4** GitHub Actions running `check` (typecheck + lint + test) on push/PR.
  **Public repo** (unlimited free Actions minutes + doubles as portfolio); `runs-on: ubuntu-latest` only; cache deps via `setup-node`; trigger on PRs + pushes to `main`.
- 🟢 **Checkpoint:** `pnpm dev` + `pnpm convex dev` — local page shows a value coming live from Convex, green CI. Reactive path + quality gates proven. (No hosting yet — that's M7.)

### M2 — Rooms & real-time lobby
Goal: the "join a room and see each other" moment — the core real-time proof.
- **BE-2.1** `polls`, `users` schema + indexes.
- **BE-2.2** `createPoll` (room-code gen + collision retry) and `joinPoll` mutations.
- **BE-2.3** `getPollState` reactive query (poll meta, phase, user list).
- **QA-2.1** Unit-test room-code generator (alphabet, length, uniqueness); `convex-test` for create/join guards (bad code, duplicate join).
- **FE-2.1** Home screen: Create / Join-with-code.
- **FE-2.2** Create screen → host lands in lobby holding `hostToken`/`userId` in localStorage.
- **FE-2.3** Lobby: big room code + live user list.
- 🟢 **Checkpoint:** open on two devices, join with the code, watch the user list update live on both. **This is the app's "it's real" demo.** (Locally: `vite --host` + LAN IP, or a tunnel like ngrok — no hosting needed.)

### M3 — Options / suggestion phase
Goal: collaborative option gathering.
- **BE-3.1** `options` schema + index; `allowUserOptions` flag on poll.
- **BE-3.2** `addOption` mutation (phase + permission gated); extend `getPollState` with options.
- **FE-3.1** Create screen: seed options + "let users add options" toggle.
- **FE-3.2** Lobby: live option list + add-option box (shown/hidden per the flag).
- 🟢 **Checkpoint:** a room fills with options in real time from multiple devices.

### M4 — Voting (interaction core)
Goal: the signature drag-to-rank experience with the "hard no" cutoff.
- **BE-4.1** `ballots` schema + `by_poll_user` upsert index.
- **BE-4.2** `advancePhase` (lobby → voting), host-gated.
- **BE-4.3** `submitBallot` upsert (re-voting), phase-gated; add "N of M voted" to state.
- **FE-4.1** Phase-driven routing so all clients switch to Voting when the host starts.
- **FE-4.2** dnd-kit ranking list with a draggable **cutoff line**; mobile touch-tuned.
- **FE-4.3** Submit + live "N of M voted"; re-order and re-submit until close.
- **QA-4.1** `convex-test` for `submitBallot` (phase gate, upsert overwrites prior ballot); component test for the ranking + cutoff interaction.
- 🟢 **Checkpoint:** whole room ranks options and submits; vote progress updates live. (Winner not computed yet.)

### M5 — Scoring & reveal (MVP complete)
Goal: close the loop — a real winner, revealed to everyone.
- **BE-5.1** Pure `score(ballots, options, method)` — Borda + cutoff; unit-tested.
- **BE-5.2** `advancePhase` (voting → revealed); `getResults` reactive query.
- **FE-5.1** Reveal screen: winner spotlight + ranked results bar chart.
- **FE-5.2** Host "new round / new poll" control.
- 🟢 **Checkpoint: END-TO-END MVP.** Create → join → add options → rank → reveal winner, live for the room. This is the first version worth putting in the portfolio.

### M6 — Polish
Goal: make it feel finished.
- **BE-6.1** Guard rails: rejoin/reconnect, host-token edge cases, empty-ballot handling.
- **FE-6.1** Empty/error/loading/reconnect states across screens.
- **FE-6.2** Mobile layout pass, transitions, reveal animation.
- **FE-6.3** Shareable room link (and QR — stretch).
- 🟢 **Checkpoint:** demo-quality build; no rough edges on the happy path.

### M7 — Production deploy & docs
Goal: shippable portfolio artifact.
- **BE-7.1** `npx convex deploy` to prod; env wired.
- **FE-7.1** Point frontend at prod `VITE_CONVEX_URL`; production build + host.
- **DOC-7.1** README: architecture diagram, live link, demo GIF, design write-up (reactive queries, pluggable scoring).
- 🟢 **Checkpoint:** public live link + polished README.

**Two natural stopping points to show people:** the **M2 checkpoint** (real-time rooms — proves the hard part works) and the **M5 checkpoint** (full MVP — the complete story). M6–M7 turn the MVP into a portfolio piece.

---

## 10. Deployment

- Convex: `pnpm convex deploy` (prod deployment + env).
- Frontend: Vercel/Netlify from the repo; set `VITE_CONVEX_URL` to the prod deployment.
- README: architecture diagram, live link, demo GIF, notes on the reactive-query design and
  the pluggable scoring function (good talking points for a portfolio).

---

## 11. Stretch goals

- Instant-runoff scoring toggle (infra already supports it).
- QR code for the room link.
- Presence / "who's here" and per-user "has voted" ticks.
- Poll expiry + code recycling.
- Result share image.
- Host controls: kick user, reopen voting, re-run with same options.

---

## Decisions locked

- **Name** — "Group Vote" (working title).
- **Mobile-first** — yes; user-facing screens designed phone-first.
- **Re-voting** — yes; users can change their ballot until the host closes voting.
