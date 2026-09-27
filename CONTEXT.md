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

### Spec Integrity Check (added 2026-08-22, after SPEC.md was found empty)
`SPEC.md` once went silently empty of real content for multiple sessions
— `CONTEXT.md` kept claiming decisions were "written into `SPEC.md`" but
the file only ever held continuity-log text (lost during a
`create-next-app` file-shuffle with no git checkpoint to catch it). To
prevent a repeat:
- After writing a decision into `SPEC.md`, read/diff the file back before
  declaring it saved — don't trust a prior summary.
- Commit `SPEC.md` right after each locked decision, not batched at
  session end, so `git log -- SPEC.md` is a reliable safety net.
- Before any operation that touches the working directory wholesale
  (scaffolding tools, moving files aside), commit first and diff after.
- End of session: confirm `SPEC.md` and `CONTEXT.md` have actually
  diverged in content — near-identical text is a red flag.

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

**Task 2 is fully COMPLETE** (commit `b94e7b5`). Hit real Prisma 7
breaking changes along the way — full detail in `docs/LEARNING_LOG.md`:
`datasource.url` moved to a new `prisma.config.ts` file; `PrismaClient`
now requires an explicit driver `adapter` (`@prisma/adapter-pg` + `pg`)
instead of implicitly reading `DATABASE_URL`; and DB connectivity itself
needed Supabase's **Session pooler** (port `5432`), not the direct
connection (IPv6-blocked) or the Transaction pooler (port `6543`, doesn't
support the session-level locks `migrate` needs — hangs, doesn't error).
`.gitignore`'s `.env*` pattern also had to be amended with `!.env.example`
so the safe template file wasn't excluded from git along with the real
`.env`. A real DB password leaked into this chat transcript twice (once
via an env-change notification, once via an unmasked `grep`) and was
rotated afterward — mask credential values in any future debugging output.

**Task 3 is fully COMPLETE** (commit `a104434`) — `hashPassword`/
`verifyPassword` in `src/lib/password.ts`, TDD flow, 3/3 tests passing.

**Task 4 is fully COMPLETE** (commit `a3b7029`) — `POST /api/signup`
route, TDD flow, 3/3 tests passing, no detours.

**Task 5 is fully COMPLETE** (commit `eca296b`) — `verifyCredentials`,
`authOptions`, NextAuth type augmentation, and the `[...nextauth]` route
handler, all matching the plan as written (`next-auth@4.24.15` confirmed
to match the plan's assumptions, unlike Prisma). 10/10 tests passing
across all 4 test files.

**Task 6 is fully COMPLETE** (commit `f536f1a`) — signup/login pages,
`SessionProvider` wired into `layout.tsx`, full signup→login→wrong-
password flow manually verified in the browser against the real
Supabase DB, all 5 checks passed first try.

## PROJECT FOUNDATION PLAN: FULLY COMPLETE (commit `e1b018a`)

All 7 tasks done — scaffold, Prisma schema/DB, password hashing, signup
API, NextAuth Credentials+JWT, login/signup pages, role-based middleware.
15/15 tests passing. All checkboxes in
`docs/superpowers/plans/2026-08-16-project-foundation.md` marked `[x]`.
Full step-by-step "what + why" for every step (including several real
Prisma 7 / Supabase breaking-change detours) is in `docs/LEARNING_LOG.md`.

## MCQ Core plan: WRITTEN, not yet executed

Plan file: `docs/superpowers/plans/2026-08-22-mcq-core.md` (7 tasks:
session helper, scoring logic, start-attempt + API route, submit-attempt/
scoring + API route, quiz list page, take-quiz page with timer +
localStorage cache, result page).

**Important discovery this session:** `SPEC.md` never actually contained
the MCQ design content — it only had the same continuity-log text as
`CONTEXT.md` (confirmed via `git log -- SPEC.md`: untouched since the
very first scaffold commit `211edcd`). The design decisions summarized in
this file were re-confirmed with the user and are now the authoritative
source, captured in the plan's "Global Constraints" section:
- Retake (`SINGLE_ATTEMPT`): blocks a second start, resumes the existing
  unsubmitted attempt or redirects to its result if already submitted.
- Scoring: exact-match only, no partial credit, same rule for
  `SINGLE_SELECT`/`MULTI_SELECT`.
- `isLeaderboardEligible` recomputed on every submit across the user's
  attempts for that quiz (`UNLIMITED_BEST` picks highest score,
  earliest-submitted tiebreak; `UNLIMITED_LATEST` picks most recent).
- `Attempt` row created on start (`submittedAt: null`), updated on submit.
- Timer expiry auto-submits whatever's cached in `localStorage`.
- Quiz list cards show title/description/time limit + the user's past
  attempt status.

**TODO after this plan executes:** copy these decisions into `SPEC.md`
for real (see the plan's "Post-plan spec repair" section) so it's
load-bearing again for Admin Authoring and Leaderboard, which depend on
this data model.

Also caught mid-planning: this repo is Next.js **16** (`AGENTS.md`'s
warning about breaking changes is real) — dynamic route/page `params` are
now `Promise<T>` and must be `await`ed, not the old synchronous object.
Checked `node_modules/next/dist/docs/01-app/01-getting-started/
15-route-handlers.md` and `03-layouts-and-pages.md` to confirm before
finalizing the plan's route handlers and page components.

Continue the same execution mode: guide step-by-step, explain why, log to
`docs/LEARNING_LOG.md`, user runs test-writing edits themselves while
boilerplate/config file creation and command execution can be done
directly when explicitly asked (established pattern — see
[[feedback-hands-on-execution]]).

## MCQ Core plan: execution progress (updated 2026-08-22, later same day)

Tasks 1–3 of 7 are fully complete (code + tests passing + committed,
commit `532494c` — all in one commit this session since CONTEXT.md/plan
files and the code landed together; not a deviation from per-task
commits going forward, just how this session's history fell):

- **Task 1 (session helper)** — `src/lib/session.ts` /
  `getCurrentUser()`. 2/2 tests passing.
- **Task 2 (scoring logic)** — `src/lib/quiz/scoring.ts` /
  `scoreAnswer()`, pure exact-match function. 7/7 tests passing.
- **Task 3 (start-attempt logic + API route)** — `src/lib/quiz/attempts.ts`
  `startAttempt()` (retake-policy enforcement) +
  `src/app/api/quizzes/[quizId]/start/route.ts`. 5/5 + 3/3 tests passing.

## MCQ CORE PLAN: FULLY COMPLETE (2026-09-27)

Tasks 4–7 finished this session, each following the same TDD rhythm
(failing test → implement → passing test → commit query/logic, then
manual browser verification → commit UI):

- **Task 4 (submit-attempt logic + API route)** — `submitAttempt()` +
  `resolveLeaderboardEligibility()` in `src/lib/quiz/attempts.ts`,
  `POST /api/attempts/[attemptId]/submit`. Commits `3cb0d75` (code),
  `5d7f605` (docs).
- **Task 5 (quiz list page)** — `getQuizzesWithStatus()`
  (`ac1c8df`), then `page.tsx` + `StartQuizButton.tsx` (`361bd30` —
  committed a session later than the query, since Step 9 was initially
  missed; caught and fixed when starting Task 6).
- **Task 6 (take-quiz page)** — `getQuizForTaking()` (`f01bd5e`), then
  `page.tsx` + `QuizTakeForm.tsx` (`a80ebd7`). Manually verified: timer
  countdown, radio/checkbox rendering per question type, `localStorage`
  answer persistence across refresh, submit → redirect.
- **Task 7 (result page)** — `getAttemptResult()` (`5350ec2`), then
  `page.tsx` (`706beac`). Manually verified: score + per-question
  correct/selected labeling, `/quizzes` list reflecting the new
  attempt status.

Test quiz used for manual verification throughout: "Sample Quiz"
(id `cmuiplsqr0000zcsifjnz15md`), 5 questions (mixed `SINGLE_SELECT`/
`MULTI_SELECT`), `UNLIMITED_BEST` retake policy — left in the dev DB,
along with a couple of throwaway signup test accounts (one fixed at
`quiztest.manual@example.com` / `TestPass123!` for repeat manual
testing). Not cleaned up — harmless dev-only data, not part of any
migration/seed.

Full plan file `docs/superpowers/plans/2026-08-22-mcq-core.md`: all 7
tasks' checkboxes marked `[x]`. Task 4–7 decisions (submission/scoring
flow, leaderboard eligibility recompute rule, take/result page
contracts) copied into `SPEC.md` per the plan's "Post-plan spec repair"
section — verified by reading the file back after the edit, per
[[feedback-spec-integrity-check]]. While doing that repair, also
removed a stale continuity-log block that had accumulated at the bottom
of `SPEC.md` (leftover text from before Project Foundation was even
executed) — same category of issue the Spec Integrity Check section
above was written to prevent; asked the user before deleting it.

## ADMIN AUTHORING PLAN: FULLY COMPLETE (2026-09-27, same session)

All 8 tasks of `docs/superpowers/plans/2026-09-27-admin-authoring.md`
done, following the same TDD rhythm as MCQ Core:

- **Task 1** (`validateQuizJson`, `src/lib/quiz/quizJsonSchema.ts`) —
  `96e0a02`.
- **Task 2** (`getAllQuizzesForAdmin`) — `508e66a`.
- **Task 3** (`createQuizFromJson` + `POST /api/admin/quizzes`) —
  `83dd34e`.
- **Task 4** (`replaceQuizFromJson` + `PUT /api/admin/quizzes/[quizId]`)
  — `a3848fd`.
- **Task 5** (`deleteQuizById` + `DELETE /api/admin/quizzes/[quizId]`)
  — `136edd0`.
- **Task 6** (admin quiz list page + `DeleteQuizButton`) — `4926b37`.
- **Task 7** (`QuizJsonEditor` + new-quiz page) — `f2558e1`, plus a
  user-requested addition mid-task: download-as-file and
  upload-from-file actions on the editor, designed as a bounded change
  and locked into `SPEC.md` (`e1b2569`) before implementing.
- **Task 8** (`getQuizAsJson` + edit-quiz page) — `01aa328` (query),
  `45a8da3` (page). Hit and fixed a real bug during Task 8: the query's
  "sort questions by order" test failed because the mocked Prisma
  `findUnique` doesn't actually apply `orderBy` — needed an explicit
  `.sort()` in application code, same pattern `getQuizForTaking`
  (MCQ Core) already used; missed it the first time, caught by the
  test itself.

Also cleaned up two lingering issues surfaced during Admin Authoring,
neither caught by the test suite — both via `eslint`/editor red
squiggle instead: a `String` (JS wrapper type) vs `string` (primitive)
typo in `QuizListItem` from MCQ Core Task 5 (`1f056ab`), and unused
stray imports in the create-quiz route (`9af51cc`). Worth an
`eslint`/`tsc --noEmit` sweep at the end of any plan, not just
`vitest`.

**Test quiz used for Task 8's edit-testing:** deliberately *not*
"Sample Quiz" (already has 4 submitted attempts) — used one of the
zero-attempt "New Quiz" rows created during Task 7's manual testing
instead, to avoid the documented FK-violation backlog limitation.

`SPEC.md`'s Admin Authoring section updated to reflect full
implementation, including the download/upload addition.

## LEADERBOARD PLAN: FULLY COMPLETE (2026-09-27, same session)

Brainstormed, spec'd, planned, and all 4 tasks of
`docs/superpowers/plans/2026-09-27-leaderboard.md` executed and
committed in one session, right after Admin Authoring:

- **Task 1** (`Quiz.leaderboardSize` migration
  `20260927082130_add_leaderboard_size`, threaded through
  `quizJsonSchema.ts`/`adminQuizzes.ts`/`getQuizAsJson`) — `76997d8`.
  Hit a real gotcha: `npx prisma migrate dev` applied the DB migration
  but left the generated Prisma Client stale (TS errors on the new
  field) until `npx prisma generate` was run explicitly — worth
  remembering for any future schema change.
- **Task 2** (`getLeaderboard`, tiebreak chain score→completionSeconds
  →submittedAt, `hasAttempted`/`ownRank` disambiguation) — `faee210`.
- **Task 3** (leaderboard page,
  `/quizzes/[quizId]/leaderboard/page.tsx`) — `ca2781c`. Manual
  verification hit the exact FK-violation backlog limitation for real:
  tried editing "Sample Quiz" (which has attempt history) to set
  `leaderboardSize`, got the documented Prisma FK error. Switched to a
  zero-attempt test quiz instead, per the plan's own guidance. Also
  surfaced a related client-side gap (now logged in `SPEC.md`):
  `QuizJsonEditor.tsx` assumes a JSON body on every error response,
  but a raw `500` has none, so `res.json()` itself throws.
  Test data for manual verification (3 scored users + 1 never-attempted)
  was seeded via real signup/start/submit HTTP calls (not faked in the
  DB directly), so `isLeaderboardEligible` was set by actual
  `submitAttempt` logic.
- **Task 4** (nav links on `/quizzes` and the result page) — `33b20d6`.

Also hit and fixed a stray dev-server issue mid-task: the `next dev`
process had been running since before the migration, so it held a
stale Prisma Client in memory even after `prisma generate` — needed an
explicit restart (kill port 3000, relaunch) before the new field
showed up anywhere at runtime.

`SPEC.md`'s Leaderboard section updated to reflect full implementation.

## Next steps
1. **Home Placeholder** — small, may fold into another plan's scope.
   Last item on the original roadmap; not yet planned at all.
2. `IMMEDIATE` feedback mode remains explicitly out of scope until a
   future plan targets it.
3. Backlog (from Admin Authoring's design, not yet scheduled): protect
   quizzes with existing attempts from edit/delete (currently throws a
   raw 500), and/or move full-replace-on-save to an incremental
   (diff-based) update. The `QuizJsonEditor.tsx` client-side error-body
   assumption (surfaced during Leaderboard testing) is coupled to
   whichever of these gets built first.

Side questions already answered this session (don't need to re-explain
unless asked again): Next.js's dev server is separate from Vite — Vite is
only Vitest's internal engine for running unit tests, not the app's dev
server; Next.js dev server has Fast Refresh (hot reload) on by default,
no config needed.

## Notes on working style (for continuity, not preference change)
- User answers one question at a time; sometimes rejects a question to ask
  for clarification/recommendation first — give a direct recommendation
  with reasoning when asked "what's best/most scalable/cost-efficient",
  don't just re-list options.
- User wants configurability pushed to the quiz/question level in several
  places (question type, retake policy, feedback timing) rather than fixed
  global behavior — lean toward per-quiz/per-question config over global
  settings when a similar choice comes up later.
