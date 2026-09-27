# Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution mode override for this project:** the user personally runs
> every command and writes every file by hand (or explicitly delegates a
> specific step to the assistant in the moment). The assistant's job is
> to walk through this plan step-by-step, explain the "why", and give the
> exact command/code for the *current* step only — then wait for the user
> to run it and report back before proceeding to the next step. Do not
> use Bash/Write/Edit to perform the steps below on the user's behalf
> unless explicitly asked for that specific step.

**Goal:** Let any logged-in user view a per-quiz leaderboard — the top
scorers (ranked by score, then completion speed, then submission order)
plus their own rank if they're not already in that top list.

**Architecture:** One new Prisma field (`Quiz.leaderboardSize`) drives a
per-quiz configurable cutoff. A single read function,
`getLeaderboard()`, joins `Attempt`/`User` and does all ranking/tiebreak
logic in one place — same layering as every other MCQ Core read
(`getQuizzesWithStatus`, `getQuizForTaking`, `getAttemptResult`,
`getAllQuizzesForAdmin`, `getQuizAsJson`, all in
`src/lib/quiz/queries.ts`). The leaderboard page is a pure server
component reading straight from that function — no API route, since
there's no mutation involved. Because `leaderboardSize` is only
author-able through Admin Authoring's JSON editor, Task 1 threads it
through that already-shipped feature's validation/write/read paths
before anything else in this plan can be meaningfully tested end to end.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7, Zod,
Vitest.

**Spec:** `SPEC.md` → "Leaderboard" section (commit `8cb2d61`) — the
data model addition, `getLeaderboard` contract, tiebreak chain, and
page/access rules below are copied from and must stay consistent with
that section.

## Global Constraints

- Per-quiz leaderboard, not global/cross-quiz — no aggregation across
  different quizzes.
- `Quiz.leaderboardSize` (`Int`, `@default(10)`) is per-quiz
  configurable, authored the same way every other quiz field is: through
  Admin Authoring's JSON editor. Optional in the JSON, defaulting to
  `10` when omitted — same pattern as per-question `points`.
- Ranking only ever considers `Attempt` rows where
  `isLeaderboardEligible: true` — exactly one per user per quiz, per the
  rule `submitAttempt` already enforces (MCQ Core).
- Tiebreak chain, in order: **`score` desc → `completionSeconds` asc
  (fastest wins) → `submittedAt` asc (earliest wins)**.
- `displayName` is `user.name` if set, otherwise the email's prefix
  before `@` — never the full email address.
- Every `LeaderboardEntry` (in `top` and as `ownRank`) carries `userId`,
  so the page can tell "already visible in `top`" apart from "never
  attempted" without `ownRank`'s `null` meaning two different things.
- Viewing the leaderboard requires being logged in, but **no role
  restriction and no requirement to have attempted the quiz** — same
  access level as browsing `/quizzes`.
- All new server-side logic that isn't purely UI-rendering must have a
  Vitest unit test written and run **before** the implementation, per
  this project's established TDD flow.

## Review Focus

- Two eligible attempts tied on both `score` and `completionSeconds` —
  the `submittedAt` tiebreak must actually separate them, not leave the
  order undefined. Covered in Task 2 (`getLeaderboard`).
- A user has never attempted the quiz — `hasAttempted` must be `false`
  and `ownRank` must be `null`, and the page must render a message
  ("You haven't attempted this quiz yet"), not crash or show a blank
  rank. Covered in Task 2 and Task 3.
- A user's eligible attempt already ranks inside `top` — `ownRank` must
  be `null` (no duplicate row) while `hasAttempted` is still `true`, so
  the page doesn't confuse this with "never attempted." Covered in
  Task 2.
- Fewer eligible attempts exist than `leaderboardSize` (e.g. 2 attempts,
  `leaderboardSize: 10`) — `top` must return exactly what exists, no
  padding, no out-of-bounds error from slicing past the array's length.
  Covered in Task 2.
- The `quizId` in the URL doesn't correspond to any quiz — must `404`,
  not throw on a `null` quiz. Covered in Task 2 and Task 3.

---

## File Structure

New/modified files this plan touches:

- `prisma/schema.prisma` (modify) — add `Quiz.leaderboardSize`.
- `src/lib/quiz/quizJsonSchema.ts` (modify) — accept optional
  `leaderboardSize` in the admin JSON, default `10`.
- `src/lib/quiz/adminQuizzes.ts` (modify) — persist `leaderboardSize` on
  both create and full-replace.
- `src/lib/quiz/queries.ts` (modify) — add `leaderboardSize` to
  `getQuizAsJson`'s round-trip shape (Task 1); add `getLeaderboard()`
  (Task 2), the actual ranking read.
- `src/app/quizzes/[quizId]/leaderboard/page.tsx` — server component,
  the leaderboard page itself (Task 3).
- `src/app/quizzes/page.tsx` (modify) — add a "Leaderboard" link per
  quiz card (Task 4).
- `src/app/quizzes/[quizId]/result/[attemptId]/page.tsx` (modify) — add
  a "Leaderboard" link (Task 4).

---

### Task 1: Add `Quiz.leaderboardSize` and thread it through Admin Authoring

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/quiz/quizJsonSchema.ts`
- Modify: `src/lib/quiz/quizJsonSchema.test.ts`
- Modify: `src/lib/quiz/adminQuizzes.ts`
- Modify: `src/lib/quiz/adminQuizzes.test.ts`
- Modify: `src/lib/quiz/queries.ts` (`getQuizAsJson` only — `getLeaderboard`
  is Task 2)
- Modify: `src/lib/quiz/queries.test.ts` (`getQuizAsJson` tests only)

**Interfaces:**
- Consumes: nothing new.
- Produces: `QuizJsonInput.leaderboardSize?: number` (Task 1, in
  `quizJsonSchema.ts`) and `QuizJsonData.leaderboardSize: number` (Task 1,
  in `queries.ts`) — Task 2's `getLeaderboard()` reads
  `quiz.leaderboardSize` directly off the Prisma model, not off either of
  these JSON-shape types.

- [x] **Step 1: Add the field and migrate**

Add `leaderboardSize` to the `Quiz` model in `prisma/schema.prisma`:

```prisma
model Quiz {
  id               String       @id @default(cuid())
  title            String
  description      String?
  timeLimitSeconds Int
  retakePolicy     RetakePolicy
  feedbackMode     FeedbackMode
  maxScore         Int          @default(0)
  leaderboardSize  Int          @default(10)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  questions        Question[]
  attempts         Attempt[]
}
```

Run: `npx prisma migrate dev --name add_leaderboard_size`
Expected: a new migration folder under `prisma/migrations/`, and the
command finishes without error (it also regenerates the Prisma client).

- [x] **Step 2: Write the failing tests**

In `src/lib/quiz/quizJsonSchema.test.ts`, add `leaderboardSize: 10` to
the shared `validQuiz` fixture (so every existing test that asserts
against it stays accurate once the field is real), and add one new
test for the default:

```typescript
// validQuiz gains one field — add it to the existing object literal:
const validQuiz = {
  title: 'Capitals Quiz',
  description: 'Test your knowledge of world capitals',
  timeLimitSeconds: 300,
  retakePolicy: 'UNLIMITED_BEST',
  feedbackMode: 'END_ONLY',
  leaderboardSize: 10,
  questions: [
    {
      text: 'What is the capital of France?',
      type: 'SINGLE_SELECT',
      points: 10,
      options: [
        { text: 'Paris', isCorrect: true },
        { text: 'London', isCorrect: false },
      ],
    },
  ],
}
```

```typescript
// add to the describe('validateQuizJson', ...) block in
// src/lib/quiz/quizJsonSchema.test.ts
it('defaults a missing leaderboardSize to 10', () => {
  const input: any = { ...validQuiz }
  delete input.leaderboardSize

  const result = validateQuizJson(input)

  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.data.leaderboardSize).toBe(10)
  }
})
```

In `src/lib/quiz/adminQuizzes.test.ts`, add `leaderboardSize: 10` to the
shared `quizInput` fixture, and add `leaderboardSize: 10` to both
existing expectations that assert the full `prisma.quiz.create`/
`prisma.quiz.update` call data (`'creates the quiz with nested
questions/options and a computed maxScore'` and `'deletes existing
questions, updates metadata, and creates the new questions/options'`).

In `src/lib/quiz/queries.test.ts`, update `getQuizAsJson`'s existing
`'reverse-maps the quiz into the admin JSON shape, sorted by order'`
test: add `leaderboardSize: 10` to the mocked `prisma.quiz.findUnique`
return value, and to the test's expected `result`.

- [x] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/quiz/quizJsonSchema.test.ts src/lib/quiz/adminQuizzes.test.ts src/lib/quiz/queries.test.ts`
Expected: FAIL — the new `quizJsonSchema` test fails because
`leaderboardSize` isn't in the schema yet; the `adminQuizzes` and
`queries` tests fail because their expectations now include
`leaderboardSize` but the implementations don't produce/consume it yet.

- [x] **Step 4: Write minimal implementation**

In `src/lib/quiz/quizJsonSchema.ts`, add the field to the Zod schema and
its default:

```typescript
// add to the quizJsonSchema object in src/lib/quiz/quizJsonSchema.ts:
const quizJsonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  timeLimitSeconds: z.number().int().positive(),
  retakePolicy: z.enum(['UNLIMITED_BEST', 'UNLIMITED_LATEST', 'SINGLE_ATTEMPT']),
  feedbackMode: z.literal('END_ONLY'),
  leaderboardSize: z.number().int().positive().optional(),
  questions: z.array(questionSchema),
})
```

```typescript
// change the withDefaults construction at the end of validateQuizJson:
const withDefaults: QuizJsonInput = {
  ...data,
  leaderboardSize: data.leaderboardSize ?? 10,
  questions: data.questions.map((question) => ({
    ...question,
    points: question.points ?? 10,
  })),
}
```

In `src/lib/quiz/adminQuizzes.ts`, persist it on both writes:

```typescript
// in createQuizFromJson's prisma.quiz.create call, add to `data`:
maxScore,
leaderboardSize: data.leaderboardSize ?? 10,
```

```typescript
// in replaceQuizFromJson's tx.quiz.update call, add to `data`:
maxScore,
leaderboardSize: data.leaderboardSize ?? 10,
```

In `src/lib/quiz/queries.ts`, add it to `getQuizAsJson`'s type and
return value:

```typescript
export type QuizJsonData = {
    title: string
    description?: string
    timeLimitSeconds: number
    retakePolicy: 'UNLIMITED_BEST' | 'UNLIMITED_LATEST' | 'SINGLE_ATTEMPT'
    feedbackMode: 'END_ONLY' | 'IMMEDIATE'
    leaderboardSize: number
    questions: {
        text: string
        type: 'SINGLE_SELECT' | 'MULTI_SELECT'
        points: number
        options: { text: string; isCorrect: boolean }[]
    }[]
}
```

```typescript
// in getQuizAsJson's return statement, add leaderboardSize alongside
// the other top-level fields (feedbackMode: quiz.feedbackMode, then):
leaderboardSize: quiz.leaderboardSize,
```

- [x] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/quiz/quizJsonSchema.test.ts src/lib/quiz/adminQuizzes.test.ts src/lib/quiz/queries.test.ts`
Expected: PASS — all tests in all three files.

- [x] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations \
  src/lib/quiz/quizJsonSchema.ts src/lib/quiz/quizJsonSchema.test.ts \
  src/lib/quiz/adminQuizzes.ts src/lib/quiz/adminQuizzes.test.ts \
  src/lib/quiz/queries.ts src/lib/quiz/queries.test.ts
git commit -m "feat: add Quiz.leaderboardSize and thread through Admin Authoring"
```

---

### Task 2: Leaderboard ranking query

**Files:**
- Modify: `src/lib/quiz/queries.ts` (add `getLeaderboard`)
- Modify: `src/lib/quiz/queries.test.ts` (add `getLeaderboard` tests;
  extend the `prisma` mock — see Step 1)

**Interfaces:**
- Consumes: nothing new (reads `prisma.quiz.findUnique` and
  `prisma.attempt.findMany` directly).
- Produces:
  ```typescript
  export type LeaderboardEntry = {
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
  export async function getLeaderboard(quizId: string, userId: string): Promise<LeaderboardResult>
  ```
  Task 3's leaderboard page calls this directly (no API route).

- [x] **Step 1: Write the failing tests**

Extend the `prisma` mock at the top of `src/lib/quiz/queries.test.ts` to
add `attempt.findMany`:

```typescript
// the vi.mock('@/lib/prisma', ...) factory at the top of
// src/lib/quiz/queries.test.ts becomes:
vi.mock('@/lib/prisma', () => ({
  prisma: {
    quiz: { findMany: vi.fn(), findUnique: vi.fn() },
    attempt: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}))
```

```typescript
// add to the bottom of src/lib/quiz/queries.test.ts
import { getLeaderboard } from './queries'

function eligibleAttempt(overrides: Partial<{
  userId: string
  score: number
  completionSeconds: number | null
  submittedAt: Date
  name: string | null
  email: string
}>) {
  const { name, email, ...rest } = overrides
  return {
    userId: 'user-x',
    score: 0,
    completionSeconds: 60,
    submittedAt: new Date('2026-09-01T00:00:00Z'),
    ...rest,
    user: {
      name: name ?? null,
      email: email ?? 'user-x@example.com',
    },
  }
}

describe('getLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the quiz does not exist', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(null)
    const result = await getLeaderboard('missing-quiz', 'user-1')
    expect(result).toEqual({ ok: false, status: 404, error: 'Quiz not found.' })
  })

  it('ranks by score desc, then completionSeconds asc, then submittedAt asc', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      title: 'Quiz One',
      leaderboardSize: 10,
      questions: [{ points: 10 }, { points: 20 }],
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 20, completionSeconds: 100, submittedAt: new Date('2026-09-01T00:00:00Z'), name: 'Alice' }),
      eligibleAttempt({ userId: 'user-b', score: 30, completionSeconds: 50, submittedAt: new Date('2026-09-02T00:00:00Z'), name: 'Bob' }),
      // ties user-c and user-d on both score and completionSeconds — submittedAt must break it
      eligibleAttempt({ userId: 'user-c', score: 30, completionSeconds: 50, submittedAt: new Date('2026-09-03T00:00:00Z'), name: 'Carol' }),
      eligibleAttempt({ userId: 'user-d', score: 30, completionSeconds: 50, submittedAt: new Date('2026-09-01T12:00:00Z'), name: 'Dave' }),
    ] as any)

    const result = await getLeaderboard('quiz-1', 'user-a')

    expect(result.ok).toBe(true)
    if (result.ok) {
      // user-b/c/d tie on score (30) and completionSeconds (50); submittedAt breaks it, earliest first
      expect(result.top.map((e) => e.userId)).toEqual(['user-d', 'user-b', 'user-c', 'user-a'])
      expect(result.maxScore).toBe(30)
    }
    // pins the query shape itself — output-only assertions above wouldn't
    // catch a bug like forgetting the isLeaderboardEligible filter, since
    // the mock returns whatever it's told regardless of the query args
    expect(prisma.attempt.findMany).toHaveBeenCalledWith({
      where: { quizId: 'quiz-1', isLeaderboardEligible: true },
      include: { user: true },
    })
  })

  it('derives displayName from name, falling back to the email prefix', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      title: 'Quiz One',
      leaderboardSize: 10,
      questions: [{ points: 10 }],
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10, name: 'Alice' }),
      eligibleAttempt({ userId: 'user-b', score: 5, name: null, email: 'bob.smith@example.com' }),
    ] as any)

    const result = await getLeaderboard('quiz-1', 'user-a')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.top[0]).toEqual(expect.objectContaining({ userId: 'user-a', displayName: 'Alice' }))
      expect(result.top[1]).toEqual(expect.objectContaining({ userId: 'user-b', displayName: 'bob.smith' }))
    }
  })

  it('caps top at leaderboardSize but returns fewer if that many do not exist', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      title: 'Quiz One',
      leaderboardSize: 1,
      questions: [{ points: 10 }],
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10 }),
      eligibleAttempt({ userId: 'user-b', score: 5 }),
    ] as any)

    const result = await getLeaderboard('quiz-1', 'user-a')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.top).toHaveLength(1)
      expect(result.top[0].userId).toBe('user-a')
    }

    // fewer eligible attempts than leaderboardSize — no padding, no error
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      title: 'Quiz One',
      leaderboardSize: 10,
      questions: [{ points: 10 }],
    } as any)
    const result2 = await getLeaderboard('quiz-1', 'user-a')
    expect(result2.ok).toBe(true)
    if (result2.ok) {
      expect(result2.top).toHaveLength(2)
    }
  })

  it('sets ownRank when the caller is outside top, and hasAttempted true either way', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      title: 'Quiz One',
      leaderboardSize: 1,
      questions: [{ points: 10 }],
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10 }),
      eligibleAttempt({ userId: 'user-b', score: 5 }),
    ] as any)

    const result = await getLeaderboard('quiz-1', 'user-b')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.hasAttempted).toBe(true)
      expect(result.ownRank).toEqual(expect.objectContaining({ userId: 'user-b' }))
    }
  })

  it('leaves ownRank null (no duplicate) when the caller is already inside top', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      title: 'Quiz One',
      leaderboardSize: 10,
      questions: [{ points: 10 }],
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10 }),
    ] as any)

    const result = await getLeaderboard('quiz-1', 'user-a')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.hasAttempted).toBe(true)
      expect(result.ownRank).toBeNull()
    }
  })

  it('sets hasAttempted false and ownRank null when the caller never attempted', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      title: 'Quiz One',
      leaderboardSize: 10,
      questions: [{ points: 10 }],
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10 }),
    ] as any)

    const result = await getLeaderboard('quiz-1', 'user-never-attempted')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.hasAttempted).toBe(false)
      expect(result.ownRank).toBeNull()
    }
  })
})
```

- [x] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/quiz/queries.test.ts`
Expected: FAIL — `getLeaderboard` is not exported yet.

- [x] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/quiz/queries.ts
export type LeaderboardEntry = {
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

export async function getLeaderboard(quizId: string, userId: string): Promise<LeaderboardResult> {
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: { questions: true },
    })

    if (!quiz) {
        return { ok: false, status: 404, error: 'Quiz not found.' }
    }

    const attempts = await prisma.attempt.findMany({
        where: { quizId, isLeaderboardEligible: true },
        include: { user: true },
    })

    // score desc, then completionSeconds asc (fastest wins), then submittedAt asc (earliest wins)
    const ranked = [...attempts].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        const aTime = a.completionSeconds ?? Infinity
        const bTime = b.completionSeconds ?? Infinity
        if (aTime !== bTime) return aTime - bTime
        return a.submittedAt!.getTime() - b.submittedAt!.getTime()
    })

    const entries: LeaderboardEntry[] = ranked.map((attempt) => ({
        userId: attempt.userId,
        displayName: attempt.user.name ?? attempt.user.email.split('@')[0],
        score: attempt.score,
        completionSeconds: attempt.completionSeconds,
    }))

    const top = entries.slice(0, quiz.leaderboardSize)
    const maxScore = quiz.questions.reduce((sum, q) => sum + q.points, 0)

    const ownEntry = entries.find((entry) => entry.userId === userId)
    const isInTop = top.some((entry) => entry.userId === userId)

    return {
        ok: true,
        quizTitle: quiz.title,
        maxScore,
        top,
        ownRank: ownEntry && !isInTop ? ownEntry : null,
        hasAttempted: ownEntry !== undefined,
    }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/quiz/queries.test.ts`
Expected: PASS — all `getLeaderboard` tests, plus every pre-existing
test in this file still passing.

- [x] **Step 5: Commit**

```bash
git add src/lib/quiz/queries.ts src/lib/quiz/queries.test.ts
git commit -m "feat: add getLeaderboard query"
```

---

### Task 3: Leaderboard page

**Files:**
- Create: `src/app/quizzes/[quizId]/leaderboard/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser()` (`src/lib/session.ts`), `getLeaderboard()`
  (Task 2).
- Produces: nothing consumed by a later task in this plan.

- [x] **Step 1: Write the page**

```typescript
// src/app/quizzes/[quizId]/leaderboard/page.tsx
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getLeaderboard } from '@/lib/quiz/queries'

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ quizId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const { quizId } = await params
  const result = await getLeaderboard(quizId, user.id)

  if (!result.ok) {
    notFound()
  }

  return (
    <main>
      <h1>{result.quizTitle} — Leaderboard</h1>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Score</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {result.top.map((entry, index) => (
            <tr key={entry.userId}>
              <td>{index + 1}</td>
              <td>{entry.displayName}</td>
              <td>
                {entry.score} / {result.maxScore}
              </td>
              <td>{entry.completionSeconds ?? '—'}s</td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.ownRank && (
        <p>
          Your rank: {result.ownRank.score} / {result.maxScore}
        </p>
      )}

      {!result.hasAttempted && (
        <p>
          You haven&apos;t attempted this quiz yet. <Link href="/quizzes">Take it now</Link>
        </p>
      )}
    </main>
  )
}
```

Note: `ownRank`'s actual rank *number* isn't tracked separately from its
position in the full sorted list in Task 2's return shape — this page
only ever renders `ownRank` when the user is *not* in `top` (per Task
2's own rule), so there's no ambiguity about needing a number here; the
row simply shows their score. If a later revision wants to show "Your
rank: #47" specifically, that requires `getLeaderboard` to also return
the 1-indexed position within `entries`, which is out of scope for this
plan (not in `SPEC.md`'s locked design).

- [x] **Step 2: Manually verify in the browser**

Using an existing test quiz with a `leaderboardSize` you can see the
effect of (e.g. edit a quiz's `leaderboardSize` down to `1` via the
admin JSON editor from Admin Authoring), submit at least two different
users' attempts against it, then visit
`/quizzes/[quizId]/leaderboard`. Confirm: the table shows exactly
`leaderboardSize` rows ranked correctly, and if you log in as the
lower-ranked user, a "Your rank" line appears below the table. Then log
in as a user who has never attempted that quiz and confirm the
"You haven't attempted this quiz yet" message with a working link to
`/quizzes`. Separately, visit `/quizzes/some-fake-id/leaderboard` and
confirm a `404`.

- [x] **Step 3: Commit**

```bash
git add "src/app/quizzes/[quizId]/leaderboard/page.tsx"
git commit -m "feat: add leaderboard page"
```

---

### Task 4: Leaderboard navigation links

**Files:**
- Modify: `src/app/quizzes/page.tsx`
- Modify: `src/app/quizzes/[quizId]/result/[attemptId]/page.tsx`

**Interfaces:**
- Consumes: nothing new — both files already exist and already have
  `quiz.id`/`quizId` in scope.
- Produces: nothing consumed elsewhere — this is the last task in the
  plan.

- [x] **Step 1: Add the link to the quiz list page**

In `src/app/quizzes/page.tsx`, add a link inside each `<li>`, next to
the existing time-limit line:

```typescript
// add directly below the existing <p>Time limit: ...</p> line inside
// the quizzes.map(...) callback in src/app/quizzes/page.tsx:
<p>
  <a href={`/quizzes/${quiz.id}/leaderboard`}>Leaderboard</a>
</p>
```

- [x] **Step 2: Add the link to the result page**

In `src/app/quizzes/[quizId]/result/[attemptId]/page.tsx`, add a link
below the score line:

```typescript
// add directly below the existing <p>Score: ...</p> block in
// src/app/quizzes/[quizId]/result/[attemptId]/page.tsx:
<p>
  <a href={`/quizzes/${quizId}/leaderboard`}>View Leaderboard</a>
</p>
```

- [x] **Step 3: Manually verify in the browser**

From `/quizzes`, confirm each quiz card now has a "Leaderboard" link
that navigates to that quiz's leaderboard page. Submit an attempt on
any quiz, and on its result page confirm the "View Leaderboard" link
appears and navigates correctly.

- [x] **Step 4: Commit**

```bash
git add src/app/quizzes/page.tsx \
  "src/app/quizzes/[quizId]/result/[attemptId]/page.tsx"
git commit -m "feat: add leaderboard navigation links"
```
