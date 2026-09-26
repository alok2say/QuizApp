# Spec — Brainstorm Web App

This is the approved, final feature-by-feature spec. For in-progress
discussion state, paused questions, and execution position, see
`CONTEXT.md` instead — this file holds only locked decisions.

> **2026-08-22 note:** this file was previously stale for multiple
> sessions (see `CONTEXT.md`'s "Spec Integrity Check" for the incident).
> The sections below are being rebuilt incrementally, in step with what's
> actually implemented, rather than all at once from memory — so anything
> not yet in this file should be treated as **not yet locked**, even if
> an older paragraph elsewhere implies otherwise.

## MCQ Quiz Engine

### Data model (`prisma/schema.prisma`, committed — ground truth for fields/enums)

- `User` — `id`, `email` (unique), `passwordHash`, `name?`, `role`
  (`USER` | `ADMIN`), `createdAt`.
- `Quiz` — `id`, `title`, `description?`, `timeLimitSeconds`,
  `retakePolicy` (`UNLIMITED_BEST` | `UNLIMITED_LATEST` |
  `SINGLE_ATTEMPT`), `feedbackMode` (`END_ONLY` | `IMMEDIATE`),
  `maxScore`, `createdAt`, `updatedAt`.
- `Question` — belongs to `Quiz` (cascade delete), `text`, `order`,
  `type` (`SINGLE_SELECT` | `MULTI_SELECT`), `points`.
- `Option` — belongs to `Question` (cascade delete), `text`, `isCorrect`.
- `Attempt` — belongs to `Quiz` + `User`, `startedAt` (default now),
  `submittedAt?` (null until submit), `completionSeconds?`, `score`
  (default 0), `isLeaderboardEligible` (default false, denormalized —
  see below). Indexed on `[quizId, isLeaderboardEligible]` for cheap
  leaderboard reads.
- `AttemptAnswer` — belongs to `Attempt` (cascade delete) + `Question`,
  `selectedOptionIds` (string array), `isCorrect`, `pointsAwarded`.
  Unique on `[attemptId, questionId]`.

### Scoring

Exact-match only, no partial credit — a question is correct only if the
submitted `selectedOptionIds` set is exactly equal to the set of options
where `isCorrect: true`. Same rule for `SINGLE_SELECT` and
`MULTI_SELECT`; one function (`scoreAnswer`, `src/lib/quiz/scoring.ts`)
covers both, order-independent (set comparison, not array comparison).
An unanswered question scores 0.

### Feedback mode scope

`END_ONLY` is the only mode being implemented in the MCQ Core plan.
`IMMEDIATE` mode (per-question server check calls, so correct answers
aren't exposed upfront) is explicitly deferred — its flow will be
designed when `IMMEDIATE` mode actually gets built, not assumed now.

### Retake policy / attempt lifecycle

An `Attempt` row is created when the user starts the quiz
(`submittedAt: null`) and updated in place on submit — never created
fresh at submit time.

- `SINGLE_ATTEMPT`: starting a second attempt is blocked. If the user's
  existing attempt is unsubmitted, they resume it; if already submitted,
  they're redirected to its result instead.
- `UNLIMITED_BEST` / `UNLIMITED_LATEST`: always allow a new `Attempt` row
  to be created, regardless of prior attempts.

Implemented in `startAttempt()` (`src/lib/quiz/attempts.ts`), called from
`POST /api/quizzes/[quizId]/start`.

### Auth / session access pattern

Every server component/route that needs the caller's identity goes
through one helper, `getCurrentUser()` (`src/lib/session.ts`) — a thin
wrapper around NextAuth's `getServerSession(authOptions)` returning
`{ id, role } | null`. Auth itself (NextAuth Credentials + JWT strategy,
signup/login pages, role-based route middleware) was specced and
implemented in the Project Foundation plan; not repeated here.

### Submission & scoring flow

Client caches answers in `localStorage` (key `quiz-attempt-{attemptId}`)
while the user works through the quiz; there is no per-question server
round trip. A single batch submit — either the user clicking "Submit
Quiz" or the countdown timer reaching 0 — sends every question's
`selectedOptionIds` (missing questions default to `[]`) to
`POST /api/attempts/[attemptId]/submit`.

Server-side, `submitAttempt()` (`src/lib/quiz/attempts.ts`) does all
scoring in one pass: 404/403/409 guard (not found / wrong owner /
already submitted), scores every question via `scoreAnswer()`, writes
one `AttemptAnswer` row per question via `attemptAnswer.createMany`,
computes `completionSeconds` from `startedAt`, then recomputes
leaderboard eligibility (see below) before updating the `Attempt` row
with `score`, `submittedAt`, `completionSeconds`, and
`isLeaderboardEligible` in a single write. Scoped to `END_ONLY` feedback
mode only, per the "Feedback mode scope" section above.

### Leaderboard eligibility recomputation

`isLeaderboardEligible` is recomputed across **all** of a user's attempts
for a quiz every time any one of them is submitted, keyed off the quiz's
`retakePolicy`:

- `SINGLE_ATTEMPT`: the one attempt that exists is always eligible.
- `UNLIMITED_LATEST`: only the most-recently-submitted attempt is
  eligible; every earlier attempt is flipped to ineligible.
- `UNLIMITED_BEST`: only the highest-scoring attempt is eligible, with an
  earliest-`submittedAt` tiebreak for determinism; all others flipped to
  ineligible.

Implemented as `resolveLeaderboardEligibility()`, a private helper in
`src/lib/quiz/attempts.ts` called from `submitAttempt()`.

### Take-quiz page contract

`getQuizForTaking(quizId, attemptId, userId)` (`src/lib/quiz/queries.ts`)
guards the same way as `submitAttempt` (404/403/409 — 409 here means
"already submitted") and, on success, strips `isCorrect` from every
option and sorts questions by `order` — the take page must never receive
the answer key. `remainingSeconds` is computed server-side as
`timeLimitSeconds - (now - startedAt)`, so a page refresh doesn't reset
the clock. Rendered by
`src/app/quizzes/[quizId]/take/[attemptId]/page.tsx` (server) +
`QuizTakeForm.tsx` (client: radio for `SINGLE_SELECT`, checkbox for
`MULTI_SELECT`, 1-second countdown that auto-submits at 0).

### Result page contract

`getAttemptResult(attemptId, userId)` (`src/lib/quiz/queries.ts`) guards
404/403, and 409 if the attempt hasn't been submitted yet (redirects back
to the take page) — this is the one query allowed to reveal the answer
key, since the attempt is locked by then. Returns each question's
`isCorrect`/`pointsAwarded` alongside every option's `isCorrect` and
`wasSelected`. Rendered by
`src/app/quizzes/[quizId]/result/[attemptId]/page.tsx` (server-only, no
client component needed).

### Quiz list page contract

`getQuizzesWithStatus(userId)` (`src/lib/quiz/queries.ts`) returns every
quiz joined with that user's single most recent `Attempt` (`take: 1`,
`orderBy startedAt desc`), or `null` if never attempted. Rendered by
`src/app/quizzes/page.tsx` (server) — never attempted → "Start Quiz";
unsubmitted → "Resume Quiz"; submitted → score shown plus "Retake Quiz"
(`UNLIMITED_*`) or "View Result" (`SINGLE_ATTEMPT`). `StartQuizButton.tsx`
(client) is the single interactive piece, calling
`POST /api/quizzes/[quizId]/start` and branching on the response
(success / 409-resume / 409-view-result / other error).

### MCQ Core plan: fully implemented

All 7 tasks of `docs/superpowers/plans/2026-08-22-mcq-core.md` are
complete and committed. This closes out the MCQ Quiz Engine feature as
originally scoped for `END_ONLY` feedback mode.

### Not yet locked in this file

- Admin authoring flow (JSON editor, role-gated, full-replace-on-save) —
  not yet planned.
- Leaderboard (eligibility-flag-driven query, top-N + own-rank) — not yet
  planned.
- Home placeholder page — not yet planned.
- `IMMEDIATE` feedback mode — explicitly out of scope until a future plan
  targets it (see "Feedback mode scope" above).
