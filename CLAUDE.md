@AGENTS.md

# DemoQuizApp

Learning full-stack project: MCQ quizzes (timer, scoring, leaderboard),
admin quiz authoring via JSON, and a public PDF library.

## Stack
Next.js 16.3 (App Router), React 19.2, TypeScript, Prisma 7 + Postgres
(`@prisma/adapter-pg`), NextAuth 4 (credentials, JWT roles USER/ADMIN),
Zod 4, Vitest 4.

## Commands
- `npm run dev` / `npm run build`
- `npm test` (Vitest) · `npm run lint` · `npx tsc --noEmit`
- `npx prisma migrate dev` · `npx prisma generate`
- Visual check: `python scripts/visual-snapshots.py` (writes to `.snapshots/`)

## Code map (layered — keep this separation)
- `src/app/` — routes only: auth checks, data loading, redirects. Renders
  one View. No CSS (ESLint blocks `*.module.css` imports here).
- `src/features/<area>/` — views + behaviour (site, home, auth, library,
  quizzes, attempt, admin, design). Built from `@/ui`.
- `src/ui/` — presentational design system, no data/API calls; exported
  from `src/ui/index.ts`.
- `src/styles/tokens.css` — every visual value (colors, spacing, type).
- `src/lib/` — server logic: `auth.ts`, `session.ts`, `authorization.ts`,
  `prisma.ts`; `lib/quiz/` (queries, attempts, scoring, adminQuizzes,
  quizJsonSchema); `lib/library/catalog.ts`.
- `src/middleware.ts` — protects `/quizzes/*` (logged in) and `/admin/*` (ADMIN).
- `prisma/schema.prisma` — User, Quiz, Question, Option, Attempt, AttemptAnswer.

## Conventions
- Tests sit next to the code as `*.test.ts(x)`; TDD for lib logic.
- Test mocks: use `as never`, not `as any`.
- Pages re-check auth with `getCurrentUser()` even behind middleware.

## Read only when relevant (don't load by default)
- `docs/NAVIGATION.md` — pages, URLs, access, API routes
- `docs/DESIGN_SYSTEM.md` — where a visual change goes
- `SPEC.md` — product decisions · `CONTEXT.md` — session continuity
- `docs/LEARNING_LOG.md` — append one "why" entry per step
- `docs/superpowers/plans/` — historical plans (large; only if asked)
