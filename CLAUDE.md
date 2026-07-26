# Group Vote

Real-time, no-login group ranking app. See [PLAN.md](PLAN.md) for the full design,
data model, scoring rules, and milestones. Mobile-first.

## Stack familiarity — pace guidance

- **New to me** — explain the concepts and the _why_, go slower, smaller steps, more context:
  **Convex**, **Vite**, **Vercel hosting**, **pnpm** (I know yarn; learning pnpm).
- **Familiar** — less hand-holding needed: **dnd-kit**, **Zod**, component libraries / shadcn-style UI.
- See personal CLAUDE.md for the bite-sized-iteration, learn-as-we-go working style that applies
  especially in the unfamiliar areas above.

## Components

- Build a small internal design system: wrap shadcn/ui primitives in local components that apply
  Group Vote styling and behavior. Consume the local wrappers across the app, not raw shadcn imports.

## Package manager

- Use **pnpm** for all install/run/script commands (`pnpm install`, `pnpm add`, `pnpm dev`, etc.).
  Never use npm or yarn here — a single lockfile (`pnpm-lock.yaml`) is the source of truth.

## Quality gate

- Before a task is considered done, `pnpm check` (typecheck + lint + test) must pass.

## Convex conventions

- Keep Convex functions small and single-purpose.
- Validate all arguments with Convex validators (and Zod where richer shapes help).
- Never trust client-supplied data for authority: re-check `phase` and `hostToken` on the server
  for any state-changing mutation.

## Scope discipline

- Don't add features or refactors beyond the current sub-milestone without asking first.
  Keep changes small and reviewable (see PLAN.md milestones).
