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

**Client timing & cache rules (revised 2026-10-31, fixes lint debt +
timer bug):**
- The countdown is deadline-based: `deadline = Date.now() +
  remainingSeconds * 1000` is fixed once on mount; an interval derives
  `secondsLeft` from the clock, so it doesn't drift and isn't reset by
  answer changes (previously every answer change restarted the 1s
  timeout, slowing the clock for fast clickers). At 0 it auto-submits
  via `useEffectEvent`, so the interval always calls the latest submit.
- Cached answers are read once from `localStorage` in a lazy `useState`
  initializer, and written in the option-change handler (no
  load/save effects, so nothing can overwrite the cache with `{}`
  before it's read). To keep server and client HTML identical, the
  exported `QuizTakeForm` renders a "Loading…" shell until hydrated
  (`useSyncExternalStore`, no effect), then mounts the real form.
- The latest answers are mirrored in a ref updated in the handler, so
  `submit` reads current answers without being rebuilt per change.

### Result page contract

`getAttemptResult(attemptId, userId)` (`src/lib/quiz/queries.ts`) guards
404/403, and 409 if the attempt hasn't been submitted yet (redirects back
to the take page) — this is the one query allowed to reveal the answer
key, since the attempt is locked by then. Returns each question's
`isCorrect`/`pointsAwarded` alongside every option's `isCorrect` and
`wasSelected`, plus `quizId` and `retakePolicy` (added 2026-10-31 so the
page can offer "Retake quiz" only when the policy allows) and each
question's `type` (for round vs square marks). Questions are sorted by
`order` in code, matching the take page's numbering. Rendered by
`src/app/quizzes/[quizId]/result/[attemptId]/page.tsx` (server
component; reuses the `StartQuizButton` client island for retake).

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

**Visual design (2026-10-19, minimal):** ruled list (no cards), max
~44rem, left-aligned, small "DemoQuizApp" link back to `/`. Each row has
an MCQ-style answer bubble encoding status — empty ○ not started,
half ◐ in progress, filled ● submitted — with the status also given as
text for screen readers. Start/Resume use the filled primary button;
Retake/View Result use a quieter outline style. Button labels are
sentence case ("Start quiz", "Resume quiz", "Retake quiz", "View
result"). Score renders as "Scored N" (no max — `QuizListItem` doesn't
carry `maxScore`). Empty list shows "No quizzes yet. Check back soon."

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

- `IMMEDIATE` feedback mode — explicitly out of scope until a future plan
  targets it (see "Feedback mode scope" above).

## Home & Pages

### Pages & routes
| Route | Access | Purpose |
|---|---|---|
| `/` | public | Home placeholder (below) |
| `/login`, `/signup` | public | Credentials auth |
| `/quizzes`, `/quizzes/[quizId]/*` | logged in | Take quizzes, results, leaderboard |
| `/admin/quizzes*` | `ADMIN` | JSON quiz authoring |

### Home placeholder (`/`)
Server component; reads `getCurrentUser()` and renders session-aware links:
- Logged out: "Log in" (primary), "Sign up".
- `USER`: "Browse quizzes" (primary), "Log out".
- `ADMIN`: as `USER`, plus "Manage quizzes" (`/admin/quizzes`).

Below the links, a dashed-outline "Books and events" box marks where
real content will go — no data model or API for books/events yet.
"Log out" is a small client component (`SignOutButton`) calling
`signOut({ callbackUrl: '/' })` — the app's first logout entry point.
Site title (`layout.tsx` metadata) is **DemoQuizApp**. Styling is
intentionally minimal; real Home design deferred.

### Shared visual tokens
Color tokens (`--ink`, `--paper`, `--muted`, `--answer`, `--on-answer`,
`--rule`, with dark-mode values) live on `:root` in `globals.css`; the
Bricolage Grotesque font is loaded once in `layout.tsx` as
`--font-sans` and applied to `body`. Page CSS modules consume these
variables rather than redefining them.

### Visual design: take, result, leaderboard (designed 2026-10-31)
Concept: one paper exam — filled in (take), marked (result), posted on
the class board (leaderboard). Continues `/quizzes`: same tokens,
Bricolage, ruled lists (no cards/shadows), left-aligned, max ~44rem,
tabular figures for scores/times. Two new tokens with dark values:
`--right` (green tick) and `--mark` (red pen). Correct/wrong is never
colour-only — always a shape too (✓ / ✗ / ring). Question numbers and
option letters (A, B, C…) are shown because they are a real sequence.
Shared answer-sheet bubble styles live in
`src/app/quizzes/answerSheet.module.css`.

**Take** — options are real `<input>`s visually restyled as lettered
answer-sheet marks: round for `SINGLE_SELECT`, square for
`MULTI_SELECT` (+ "Pick all that apply"), filled `--answer` when
chosen, visible keyboard focus. A sticky bar holds the quiz title and an
`m:ss` timer that turns `--mark` under 60s. Footer: "N of M answered",
a non-blocking "K questions unanswered" note, and "Submit answers"
("Submitting…" while pending). Timing/caching logic unchanged.

**Result** — large "score / max", then one mark per question (● right,
✗ wrong) linking to `#q-N`; "Retake quiz" (only if `retakePolicy !==
SINGLE_ATTEMPT`) and "See leaderboard". Each question: number, text,
"awarded / points"; options as marks — your picks filled, correct
options get a `--right` ring + ✓, wrong picks a `--mark` ✗.

**Leaderboard** — heading "<quiz> leaderboard", one-line rule
explanation ("Best attempt per person. Ties go to the faster time."),
ruled rows: rank, name, score/max, time `m:ss`. The viewer's own row
shows "You" with an `--answer` left bar. `ownRank` (viewer outside the
top N) renders below as "Your best: S / M in m:ss, outside the top N"
— `ownRank` carries no rank number, so none is shown (previously the
page mislabelled the score as "Your rank"). Empty board: "No one has
finished this quiz yet."; not attempted: "You haven't taken this quiz
yet." — both with a "Take the quiz" `StartQuizButton`.

Implemented in `c8675a7` (2026-10-31), verified by screenshots in light/
dark and at 360px. Side fix: `html, body` used create-next-app's
`overflow-x: hidden`, which makes them scroll containers and silently
breaks `position: sticky`; switched to `overflow-x: clip`.

### Visual design: login, signup, admin (designed 2026-10-31)
Same exam-paper language and tokens. Buttons shared app-wide via
`src/app/controls.module.css` (moved up from `src/app/quizzes/`).

**Login / signup ("cover sheet")** — narrow left-aligned column
(~24rem). Fields are write-in lines (bottom rule only, turns `--answer`
on focus), labels always visible above. Errors in `--mark` below the
form. Each page is a server component reading `searchParams` and
passing props to a client form (`LoginForm` / `SignupForm`):
- Cross-links "New here? Create an account" / "Already have an
  account? Log in" carry `callbackUrl` (sanitized with
  `safeCallbackUrl`), so signup → login → original page works.
- Successful signup goes to `/login?created=1` (+ `callbackUrl` when
  not `/`); login then shows "Account created. Log in to start."
- Login error copy: "That email and password don't match. Try again or
  create an account."

**Admin quiz list** — "Manage quizzes" + "New quiz" primary button;
ruled rows: title, "N questions, added D Mon YYYY", Edit link, Delete as
a quiet `--mark` text button (existing confirm kept). Empty: "No
quizzes yet. Create the first one."

**New / edit editor** — wider column (~56rem). Heading "New quiz" /
`Edit "<title>"`. A `<details>` "What goes in the JSON" lists the
fields. Monospace textarea, full width, ~60vh. Errors as a `--mark`
list headed "Fix these before saving:". Actions: "Save quiz" (primary),
"Download JSON", "Upload JSON" (secondary), "Cancel" link to
`/admin/quizzes`.

**Error-body robustness** (client half of the parked backlog item —
does not decide edit/delete-with-attempts behavior): the editor, the
Delete button, and signup no longer assume every error response has a
JSON body. If parsing fails they show a status-based message, e.g.
"Couldn't save the quiz (server error 500). Your edits are still
here."

Implemented in `a162757` (helper `readErrorBody` in `6307535`),
verified in the browser: wrong-password error, signup → login with
"Account created" → back to the original `callbackUrl`, validation
error list, a simulated body-less `500` on save (route intercepted, not
a real DB failure), light/dark, 360px. Validation and JSON-syntax
errors get the "Fix these before saving:" heading; server failures are
shown as a single message without it.

### Shared site header (designed 2026-10-31)
`SiteHeader` (`src/app/SiteHeader.tsx` + `SiteHeader.module.css`) is a
server component rendered in `layout.tsx` above `{children}`, so it
appears on every page (including login/signup, take-quiz, admin). It
reads `getCurrentUser()` server-side — no client-side session fetch, no
logged-out flash.
- Left: "DemoQuizApp" wordmark linking to `/` (serves as the Home link).
- Right, logged in: "Quizzes" (`/quizzes`), "Admin" (`/admin/quizzes`,
  `ADMIN` only), "Log out" (reuses `SignOutButton`).
- Right, logged out: "Log in", "Sign up".
- Styling: shared tokens, bottom border `--rule`, inner content max
  ~44rem centered, 16px side gutters, wraps on narrow screens, not
  sticky; focus ring `--answer`.

Because App Router layouts don't re-render on client-side navigation,
the login page calls `router.refresh()` after a successful `signIn`
so the header picks up the new session. Logout already does a full
reload via `signOut({ callbackUrl: '/' })`.

Duplicates removed once the header exists: `/quizzes` drops its own
"DemoQuizApp" link; Home keeps only its primary action ("Browse
quizzes" logged in, "Log in" logged out) and drops "Manage quizzes",
"Log out", and "Sign up" (all now in the header).

Active section (added 2026-10-31): header links are a client
`NavLink` that sets `aria-current="page"` when the path equals the
link's href or is nested under it (`isActivePath`,
`src/lib/activePath.ts`) — ink text + 2px `--answer` underline, no
weight change. The wordmark isn't highlighted.

Out of scope: hiding the header during a
quiz attempt (answers are cached and attempts resumable, so leaving is
safe). Implemented in `7f03983`; verified in the browser (logged out /
`USER` / `ADMIN`, header updates on login and logout without reload,
dark mode, 360px width).

### Post-login return (designed 2026-10-31)
When middleware redirects an unauthorized request to `/login`, it adds
`?callbackUrl=<original pathname + search>`. After a successful
`signIn`, the login page reads `callbackUrl` from
`window.location.search` (inside the submit handler — no
`useSearchParams`/Suspense needed) and navigates there, then
`router.refresh()`. Default and fallback: `/`.

Open-redirect guard: `safeCallbackUrl()` (`src/lib/safeRedirect.ts`)
accepts only same-site relative paths — must start with `/`, must not
start with `//` or `/\` (browsers treat both as another host);
anything else (absolute URLs, empty, missing) becomes `/`.

Known, accepted: a logged-in `USER` sent from `/admin/*` to `/login`
gets `callbackUrl=/admin/...`; logging in again as `USER` just lands
back on `/login` via middleware (no automatic loop — each round needs a
manual login). Signup → login doesn't carry `callbackUrl` (out of
scope). The page-level `redirect('/login')` fallbacks in protected
pages don't add it either — middleware always runs first for those
routes.

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

## PDF Library (designed 2026-10-31)

Read PDFs inside the app. **This iteration: only PDFs shipped with the
app** (files in `public/pdfs/`, served by Next). Server-downloaded PDFs
come later; opening a file from the reader's own computer was
considered and explicitly **deferred** by the user.

### Routes & access
| Route | Shows |
|---|---|
| `/library` | Ruled list of documents: title, one-line description, page count, "Read" link |
| `/library/[slug]` | Title, "Library" back link, full-height viewer below the site header |

Public (no login), like `/` — reading needs no account; can be moved
behind middleware later. Unknown slug → `notFound()`. Header gets a
"Library" `NavLink` (shown logged in and logged out, active on
`/library/*`). Home's "Books and events" placeholder becomes a "Books"
section linking to `/library`; "Events" stays a placeholder.

### Catalog (seam for later server downloads)
`src/lib/library/catalog.ts` holds a typed list — no DB yet:
`LibraryDocument = { slug, title, description, pageCount, src }`.
Pages read only through `getDocuments()` and `getDocument(slug)`; when
server downloads arrive, only these change (to a DB/API) and `src`
becomes a server URL. `pageCount` is entered by hand for now. Lookup is
exact-match on `slug` (no path handling), so unknown or crafted slugs
return `null`.

Starter content (user-approved, from the earlier PdfViewer1 project):
`Cardiology-Chap-2.pdf` (8 pages, 0.5 MB) and `cardio-algo.pdf`
(22 pages, 4.8 MB).

### Viewer
`@embedpdf/react-pdf-viewer` **2.1.0** (MIT; PDFium compiled to
WebAssembly; built-in search, zoom, thumbnails, page navigation), same
library and version as the reference project. Browser-only, so a
`'use client'` wrapper loads it with `next/dynamic(..., { ssr: false })`
(Next 16 allows `ssr: false` only inside Client Components).
Config: `src` from the catalog; `disabledCategories: ['annotation',
'redaction', 'panel-comment']` (as in the reference); `theme:
{ preference: 'system' }` so it follows the app's light/dark; keyed by
slug so switching documents re-initializes the viewer.

**Self-hosted WASM:** by default the library fetches `pdfium.wasm`
(~7.7 MB) from jsdelivr at runtime. Instead it is copied from
`node_modules/@embedpdf/pdfium/dist/pdfium.wasm` to
`public/pdfium/pdfium.wasm` by an npm `postinstall` script (git-ignored,
so it always matches the installed version) and passed as an **absolute**
`wasmUrl` (`new URL('/pdfium/pdfium.wasm', location.origin)`) — the
engine runs in `blob:` workers, where a root-relative URL can't resolve. Fallback fonts for PDFs without embedded fonts
may still load from jsdelivr — accepted for now.

Visuals follow the app: ruled list on `/library` (44rem column), the
viewer page uses the full content width.

Implemented on branch `feature/pdf-library` (`dc13c14`, `b56275e`,
`6601527`; plan `docs/superpowers/plans/2026-10-31-pdf-library.md`).
Verified in Chromium: both PDFs render (8 and 22 pages), search
("myocardial" → 16 results), zoom in/out, page navigation, switching
documents via client navigation, `/library/nope` and
`/library/..%2FSPEC.md` → 404, wasm served from `/pdfium/pdfium.wasm`
with no jsdelivr requests, dark theme, 360px with no horizontal
overflow. The viewer is sized with `position: absolute; inset: 0` inside
a `position: relative` frame (a percentage height collapsed in the
min-height flex chain). Packages were installed from the public npm
registry because the Artifactory credentials had expired (user's call).

Final review fixes: `predev`/`prebuild` also run the wasm copy, with a
test that fails if the wasm or those hooks are missing (otherwise the
viewer hangs on "Loading" with no error). `PdfViewer` destroys the
plugin registry and PDFium engine on unmount — the library's React
wrapper only clears its DOM. **Known limitation:** the library's
2-worker image-encoder pool isn't reachable through its public API, so
2 small workers remain per document opened in a tab (measured on a
production build: 3 started, 1 freed per open).
