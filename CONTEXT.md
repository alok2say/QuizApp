# Session Continuity — Brainstorming Log

Purpose: pick up exactly where we left off in the next session. Update this
file at the end of every session; move approved decisions into `SPEC.md`.

For the step-by-step "what we did and why" during implementation, see
`docs/LEARNING_LOG.md` — kept up to date alongside this file as we execute
each plan (this project's purpose is learning, so the "why" behind each
step is deliberately recorded, not just the "what").

## Process being followed
Using the brainstorming skill, **architectural path** (new project). Flow:
clarifying questions (one at a time) → propose approaches → design sections
→ written spec (`SPEC.md`) → later, writing-plans skill for implementation.
We are still mid-design — no implementation plan yet, no code written.

## Where we are
Deep-diving the **MCQ Quiz feature** first (the priority), before touching
auth or the books/events content pages. Tech stack for the whole app was
approved (Next.js App Router + Prisma + Postgres on Neon/Supabase +
NextAuth + Vercel — see `SPEC.md` for rationale).

All MCQ *behavior* decisions are locked and written into `SPEC.md`:
question types, scoring, points, timer, retake policy, leaderboard scope/
tiebreak, feedback timing, quiz discovery = flat list.

Also now locked and in `SPEC.md`:
- **Data model**: `User`/`Quiz`/`Question`/`Option`/`Attempt`/
  `AttemptAnswer`, with `isBest` denormalized for cheap leaderboard queries.
- **Submission & scoring flow**: client-side `localStorage` cache of
  answers, single batch submit at the end (manual or timer-triggered),
  server-side all-or-nothing scoring — scoped explicitly to `END_ONLY`
  feedback mode for now. `IMMEDIATE` mode's flow (per-question server
  check calls, to avoid exposing correct answers upfront) is deferred —
  design it when `IMMEDIATE` mode actually gets built.

## MCQ feature: fully speced

Data model, submission & scoring flow, admin authoring flow (JSON editor,
role-gated, full-replace-on-save), auth (NextAuth + Prisma Adapter,
Credentials-only for v1, role-based route protection), and leaderboard
(eligibility-flag-driven query, top-N + own-rank, N configurable toward
"show all" later) are all written into `SPEC.md`. Leaderboard/admin UI
visuals are intentionally rough — explicitly deferred to a later
finalization pass, not an oversight.

## Where we are (updated)
Full site route map is now speced (`SPEC.md` → "Pages & Routes"): Home
(`/`, books/events, **placeholder-only for now**), MCQ page (`/quizzes*`,
fully wired to the already-speced quiz engine), `/login`/`/signup`,
`/admin/quizzes*`. Real Home page content/design is explicitly deferred.

## Implementation has started (moved past pure brainstorming)

Design/spec phase is done for MCQ + route map. We moved into the
writing-plans skill and agreed the implementation should be split into
separate plans, one per subsystem, in this order:
1. **Project Foundation** — PLAN WRITTEN:
   `docs/superpowers/plans/2026-08-16-project-foundation.md`. Covers
   Next.js+TS scaffold, full Prisma schema (all models), NextAuth
   Credentials+JWT auth, signup/login pages, role-based middleware. Not
   yet executed — awaiting the user's choice of subagent-driven vs inline
   execution (per writing-plans skill handoff).
2. MCQ Core (quiz list/take/submit/score) — not yet planned.
3. Admin Authoring (JSON editor CRUD) — not yet planned.
4. Leaderboard (API + page) — not yet planned.
5. Home Placeholder — small, may fold into another plan's scope.

Also decided while planning: TypeScript (not JS) for the whole project;
corrected `SPEC.md`'s Auth section — NextAuth uses Credentials + JWT
session strategy, **not** the Prisma Adapter (adapter has known
limitations with Credentials-only setups).

## Execution mode: user runs it, assistant guides (not subagent/inline)

User chose neither of the writing-plans skill's two default execution
options. Instead: **the user personally runs every command/writes every
file**; the assistant's job is to walk through the plan step-by-step,
explaining the "why" and giving the exact command/code for the *current*
step only, then wait for the user to run it and report back before
continuing. Do not use Bash/Write/Edit to perform plan tasks on the
user's behalf. Full rationale saved in memory (`feedback-hands-on-execution`).

## Current execution position (Project Foundation plan)

Plan file: `docs/superpowers/plans/2026-08-16-project-foundation.md`

**Task 1 is fully COMPLETE** (all 7 steps: scaffold, deps installed,
Vitest configured, smoke test passing, dev server confirmed, committed
in two commits — `211edcd` scaffold, `dca3033` fixing `.serena/` being
accidentally tracked). Full step-by-step rationale for every step is now
recorded in `docs/LEARNING_LOG.md` (started this session per user
request — see [[feedback-learning-log]]).

Note: `create-next-app` refused to run in the directory at first because
`CONTEXT.md`/`SPEC.md` tripped its "must be empty" check — worked around
by moving them out temporarily and back. `CONTEXT.md` got lost in that
shuffle and was restored verbatim from conversation history (no content
lost). Next.js also auto-generated `AGENTS.md` and `CLAUDE.md` in the
project root; this repo's git history predates this session (`50ef82c
Initial commit from Create Next App`) and was preserved, not overwritten,
by `create-next-app`'s `git init` call.

Resume by proceeding to **Task 2: Prisma schema + client singleton**
(Step 1: write `prisma/schema.prisma`) per the plan file.

Side questions already answered this session (don't need to re-explain
unless asked again): Next.js's dev server is separate from Vite — Vite is
only Vitest's internal engine for running unit tests, not the app's dev
server; Next.js dev server has Fast Refresh (hot reload) on by default,
no config needed.

## Next steps (in order)
1. Continue guiding the user through Task 1 of the Project Foundation
   plan, one step at a time, starting from Step 2 above.
2. After Task 1 finishes, continue with Tasks 2–7 the same way.
3. Write and execute (same guided style) the MCQ Core plan next (depends
   on Foundation).
4. Then Admin Authoring, then Leaderboard, then Home Placeholder.
5. Once each plan is executed and verified, note completion here and in
   `SPEC.md` if anything deviated from the design during implementation.

## Notes on working style (for continuity, not preference change)
- User answers one question at a time; sometimes rejects a question to ask
  for clarification/recommendation first — give a direct recommendation
  with reasoning when asked "what's best/most scalable/cost-efficient",
  don't just re-list options.
- User wants configurability pushed to the quiz/question level in several
  places (question type, retake policy, feedback timing) rather than fixed
  global behavior — lean toward per-quiz/per-question config over global
  settings when a similar choice comes up later.
