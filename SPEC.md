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

## Admin Authoring

Role-gated (`ADMIN` only, already enforced by the Project Foundation
middleware on `/admin/*`) JSON editor for creating and editing quizzes.
Design locked and fully implemented 2026-09-27 — all 8 tasks of
`docs/superpowers/plans/2026-09-27-admin-authoring.md` complete and
committed, including the download/upload JSON actions added mid-plan
(see "Editor UI shape" below).

### JSON schema

Pure content — no DB row IDs anywhere (`Quiz.id`/`Question.id`/
`Option.id` are always server-generated `cuid()`s, same mechanism as
every other model in the schema; the JSON never carries or accepts
them). Quiz-level metadata and questions live in one blob, edited as a
single unit:

```json
{
  "title": "Capitals Quiz",
  "description": "Test your knowledge of world capitals",
  "timeLimitSeconds": 300,
  "retakePolicy": "UNLIMITED_BEST",
  "feedbackMode": "END_ONLY",
  "questions": [
    {
      "text": "What is the capital of France?",
      "type": "SINGLE_SELECT",
      "points": 10,
      "options": [
        { "text": "Paris", "isCorrect": true },
        { "text": "London", "isCorrect": false },
        { "text": "Berlin", "isCorrect": false }
      ]
    },
    {
      "text": "Which of these are in Asia?",
      "type": "MULTI_SELECT",
      "options": [
        { "text": "Japan", "isCorrect": true },
        { "text": "Egypt", "isCorrect": false },
        { "text": "Vietnam", "isCorrect": true }
      ]
    }
  ]
}
```

Notes:
- Question `order` is implicit from array position — no explicit `order`
  field in the JSON.
- Option correctness is inline (`{text, isCorrect}`), not a separate
  correct-answers list — avoids two lists drifting out of sync.
- `points` is optional per question, defaulting to `10` if omitted
  (second question above relies on the default).
- `maxScore` is **not** in the JSON — always server-computed as
  `sum(question.points)`, never admin-authored directly.
- `feedbackMode` must be `END_ONLY` — rejected at validation time
  otherwise (see below), since `IMMEDIATE` mode's flow was never
  designed or implemented anywhere in the take/result pages; accepting
  it in the JSON would silently produce a quiz that behaves like
  `END_ONLY` while claiming otherwise.

### Validation (before any DB write)

Two layers, both enforced server-side before the save transaction runs:

1. **Shape/type** (via `zod`, same library already used by
   `/api/signup` and `/api/attempts/[attemptId]/submit`): every field
   present with the right type/enum — `title: string`,
   `timeLimitSeconds: positive int`, `retakePolicy` ∈ the 3 enum
   values, `feedbackMode` must be `'END_ONLY'`, question `type` ∈
   `SINGLE_SELECT`/`MULTI_SELECT`, `points` optional positive int,
   `options: {text: string, isCorrect: boolean}[]`.
2. **Semantic**:
   - `questions.length >= 1`
   - each question's `options.length >= 2`
   - each question has `>= 1` option with `isCorrect: true`
   - `SINGLE_SELECT` questions have **exactly 1** correct option;
     `MULTI_SELECT` allows 2+

Both layers live in one pure function (e.g. `validateQuizJson`),
unit-testable in isolation before touching Prisma — same pattern as
`scoreAnswer`. A failed save returns `400` with the specific list of
validation errors, not a generic "invalid" message.

### API routes & save flow

- `GET /admin/quizzes` (page) — lists all quizzes (title, question
  count, created date) with Edit/Delete actions and a "New Quiz" button.
- `POST /api/admin/quizzes` — create: validates the JSON, then creates
  `Quiz` + nested `Question`/`Option` rows in one Prisma nested-write,
  computing `maxScore` server-side.
- `GET /admin/quizzes/[quizId]/edit` (page) — loads the quiz, reverse-
  maps it into the same JSON shape (IDs stripped) via a new query (e.g.
  `getQuizAsJson`), pre-fills the editor with it (pretty-printed).
- `PUT /api/admin/quizzes/[quizId]` — full replace, in one Prisma
  transaction: delete all existing `Question` rows for the quiz
  (cascades to their `Option` rows via the existing
  `onDelete: Cascade`), update the `Quiz`'s metadata fields, create the
  new `Question`/`Option` rows fresh, recompute `maxScore`.
- `DELETE /api/admin/quizzes/[quizId]` — deletes the quiz outright
  (cascades to its questions/options).

Both writes are transactional so a failure partway through leaves the
original quiz untouched.

**Known limitation (backlog, not blocking this plan):** neither
`AttemptAnswer.questionId` nor `Attempt.quizId` cascade-deletes from
their parent. If a quiz already has submitted attempts, the `PUT`/
`DELETE` above will hit a raw Prisma FK-violation error (surfaced as an
unhandled `500`, no graceful message) instead of succeeding — full
delete-then-recreate is fundamentally incompatible with preserving
historical `Attempt`/`AttemptAnswer` references. Deferred because this
project is still in its early building phase with no real attempt
history to protect yet. Two follow-up items, either of which resolves
it:
- Block edits/deletes on any quiz that already has `>= 1` `Attempt` row,
  with a clean error message instead of the raw DB failure.
- Replace full-replace-on-save with an **incremental update** (diff
  existing questions/options against the new JSON, update in place
  where possible) — also fixes the related fact that every full-replace
  save currently mints entirely new `Question`/`Option` IDs even when
  the content didn't change.

**Related client-side gap surfaced 2026-09-27 (also backlog, not
blocking):** `QuizJsonEditor.tsx`'s error handling assumes any non-`ok`
response has a JSON body (`const body = await res.json()`), but the raw
`500` this FK violation produces has no body at all — `res.json()`
itself throws an unhandled `SyntaxError` in the browser instead of
showing a clean error message. Confirmed by actually triggering the FK
violation during Leaderboard manual testing. Fix belongs alongside
whichever of the two items above gets built first (a clean `4xx` from
either one would carry a real body).

### Editor UI shape

Both `/admin/quizzes/new` and `/admin/quizzes/[quizId]/edit` render the
same client component (e.g. `QuizJsonEditor`) — a single `<textarea>`
holding raw JSON text, plus a "Save" button. No syntax highlighting, no
schema-driven form fields, no live-validate-as-you-type — matches the
"rough is fine, polish deferred" pattern already established for
leaderboard/admin UI elsewhere in this project.

- **New:** textarea starts pre-filled with a minimal one-question
  template.
- **Edit:** textarea is pre-filled server-side with the quiz's current
  content (pretty-printed `JSON.stringify(..., null, 2)`).
- **On Save:** client `JSON.parse()`s first — a syntax error is shown
  immediately with no network call. If it parses, POST/PUT to the API
  route; a `400` renders the validation error list above the textarea
  without wiping what was typed. Success redirects to `/admin/quizzes`.
- **Download JSON:** button saves the textarea's current content as a
  `.json` file via a client-side `Blob` — no API route involved.
  Filename is derived from the current content's `title` field if it
  currently parses as valid JSON with a string `title`; otherwise falls
  back to a generic name. Works on unsaved edits, not just what's
  persisted server-side.
- **Upload JSON:** button opens a file picker (`accept="application/json"`);
  the selected file's text **fully replaces** the textarea's current
  content (matching this editor's own full-replace save semantics — not
  a merge). Since this can discard unsaved edits, it's gated behind a
  `window.confirm()`, the same destructive-action pattern already used
  by `DeleteQuizButton`.

### Not yet locked in this file

- Home placeholder page — not yet planned.
- `IMMEDIATE` feedback mode — explicitly out of scope until a future plan
  targets it (see "Feedback mode scope" above).

## Leaderboard

Per-quiz ranking (not global/cross-quiz — score comparisons across
different quizzes with different `maxScore`s and difficulty aren't
meaningful). Design locked and fully implemented 2026-09-27 — all 4
tasks of `docs/superpowers/plans/2026-09-27-leaderboard.md` complete
and committed.

### Data model addition

`Quiz` gains one field:

```prisma
leaderboardSize  Int  @default(10)
```

Needs a Prisma migration. Per-quiz configurable (not a fixed app-wide
constant) — matches this project's established pattern of pushing
config to the quiz/question level (`timeLimitSeconds`, `retakePolicy`,
`feedbackMode`, per-question `points` already work this way) rather
than fixed global rules.

**Cross-plan impact:** since Admin Authoring's JSON editor is the only
way to author quiz metadata, `leaderboardSize` must be threaded through
its already-shipped files: `quizJsonSchema.ts` (optional positive int,
default `10` — same optional-with-default pattern as per-question
`points`), `adminQuizzes.ts`'s `createQuizFromJson`/`replaceQuizFromJson`
(persist it), and `getQuizAsJson` (include it in the reverse-mapped
JSON so it round-trips on edit). This is in scope for the Leaderboard
implementation plan, not a separate plan — the field only exists to
serve this feature.

### Ranking query

`getLeaderboard(quizId, userId)` (`src/lib/quiz/queries.ts`):

```typescript
export type LeaderboardEntry = {
  rank: number
  userId: string
  displayName: string
  score: number
  completionSeconds: number | null
}

export type LeaderboardResult =
  | {
      ok: true
      quizTitle: string
      maxScore: number
      top: LeaderboardEntry[]
      ownRank: LeaderboardEntry | null
      hasAttempted: boolean
    }
  | { ok: false; status: 404; error: string }
```

- `404` if the quiz doesn't exist.
- Otherwise fetches every `Attempt` for the quiz where
  `isLeaderboardEligible: true`, joined with `User` (`name`, `email`).
- Ranks by: **`score` desc → `completionSeconds` asc (fastest wins) →
  `submittedAt` asc (earliest wins)** — the completion-time and
  submission-time tiebreaks are new; the `score`-desc-first rule is
  consistent with (but distinct from) the eligibility tiebreak used
  when recomputing `isLeaderboardEligible` in `submitAttempt`.
- `displayName`: `user.name` if set, otherwise the email's prefix
  before `@` (never the full email — avoids exposing addresses on a
  ranking visible to other users).
- `userId` is on every entry (`top` and `ownRank` alike) — every entry
  is the same shape, no special-cased intersection type.
- `top`: the first `quiz.leaderboardSize` ranked entries.
- `hasAttempted`: `true` if the calling user has an eligible attempt
  for this quiz at all, regardless of whether it landed in `top`.
- `ownRank`: the calling user's own entry (with its real rank number)
  **only** when `hasAttempted` is `true` **and** their `userId` isn't
  already present in `top` (no duplicate row); `null` otherwise —
  which covers two distinct cases the page must tell apart using
  `hasAttempted`, not `ownRank` alone: already visible in `top`
  (`hasAttempted: true`), or never attempted (`hasAttempted: false`).

### Page & access

`src/app/quizzes/[quizId]/leaderboard/page.tsx` — server component.
Requires being logged in (redirect to `/login`), but **no role
restriction and no requirement to have attempted the quiz** — any
logged-in user can view any quiz's leaderboard, same access level as
browsing `/quizzes` itself. Already covered by the existing middleware
matcher (`/quizzes/:path*`) with no changes needed.

Renders the `top` table (rank, name, score, completion time), then:
- `ownRank` present → render it as an extra "Your rank" row below the
  table.
- `ownRank` is `null` and `hasAttempted` is `true` → nothing extra
  needed; the user is already visible inside `top`.
- `ownRank` is `null` and `hasAttempted` is `false` → a message
  ("You haven't attempted this quiz yet") linking to `/quizzes`, not
  simply omitted, so it's clear why no rank is shown.

**Navigation:** a "Leaderboard" link added to each quiz card on
`/quizzes` and to the result page
(`/quizzes/[quizId]/result/[attemptId]`) — the two natural jump-off
points.
