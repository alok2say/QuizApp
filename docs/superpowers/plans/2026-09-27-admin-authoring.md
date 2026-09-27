# Admin Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Execution mode override for this project:** the user personally runs
> every command and writes every file by hand. The assistant's job is to
> walk through this plan step-by-step, explain the "why", and give the
> exact command/code for the *current* step only — then wait for the user
> to run it and report back. Do not use Bash/Write/Edit to perform the
> steps below on the user's behalf.

**Goal:** Let an `ADMIN` user create, edit, and delete quizzes through a
JSON editor — one textarea holding the quiz's full metadata + questions
+ options, saved as a full replace of that quiz's question/option set.

**Architecture:** Same layering as MCQ Core — plain TypeScript functions
in `src/lib/quiz/` do all validation and Prisma I/O, unit-tested without
HTTP; three API routes under `/api/admin/quizzes*` delegate to those
functions; Next.js server-component pages under `/admin/quizzes*` read
data straight from Prisma; one client component (`QuizJsonEditor`) is
shared between the create and edit pages, since both are "show a
textarea, POST/PUT its parsed JSON."

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7, Zod (already
a dependency, used by `/api/attempts/[attemptId]/submit`), Vitest.

**Spec:** `SPEC.md` → "Admin Authoring" section (commit `49d7011`) — the
JSON schema, validation rules, API routes, and editor UI shape below are
copied from and must stay consistent with that section.

## Global Constraints

- Role-gated to `ADMIN`. Pages under `/admin/quizzes*` are already
  covered by the Project Foundation middleware
  (`matcher: ['/quizzes/:path*', '/admin/:path*']`), but **API routes
  under `/api/admin/quizzes*` are NOT** — that matcher only covers
  `/admin/*`, not `/api/admin/*`. Every API route in this plan must do
  its own `getCurrentUser()` + `role === 'ADMIN'` check (401 if not
  logged in, 403 if logged in but not `ADMIN`), the same way existing
  routes already do their own auth checks independent of middleware.
- JSON is pure content — no `Quiz.id`/`Question.id`/`Option.id` anywhere
  in the request or response body. IDs are always server-generated
  `cuid()`s (Prisma's `@default(cuid())`, same as every other model).
- Quiz metadata and questions live in one JSON blob (not split
  form-fields + JSON).
- Option correctness is inline: `{ text: string, isCorrect: boolean }`.
- Question `order` is implicit from array position — no `order` field
  in the JSON; assigned as `index + 1` when writing to the DB.
- `points` is optional per question; defaults to `10` when omitted.
- `maxScore` is never in the JSON — always server-computed as
  `sum(question.points)` right before every write.
- `feedbackMode` must be exactly `'END_ONLY'` — reject any other value
  (including `'IMMEDIATE'`) at validation time.
- Validation is two layers, both server-side, both before any DB write:
  1. Shape/type via Zod.
  2. Semantic: quiz has `>= 1` question; each question has `>= 2`
     options; each question has `>= 1` correct option;
     `SINGLE_SELECT` questions have **exactly 1** correct option
     (`MULTI_SELECT` allows 2+).
- A failed validation returns `400` with the specific list of errors,
  not a generic message.
- A malformed (unparseable) JSON request body returns `400`, not an
  unhandled `500` — every route that reads a body must catch
  `request.json()`'s parse error.
- Full-replace-on-save runs in one Prisma transaction: delete all
  existing `Question` rows for the quiz (cascades to `Option` rows via
  the existing `onDelete: Cascade`), update the quiz's own metadata
  fields, create the new `Question`/`Option` rows fresh.
- **Known limitation, explicitly out of scope for this plan:** neither
  `AttemptAnswer.questionId` nor `Attempt.quizId` cascade-deletes. If a
  quiz already has submitted attempts, the replace/delete transaction
  will throw an unhandled Prisma FK-violation error (surfaced as a raw
  `500`). Do not add any guard against this — it's tracked as a backlog
  item in `SPEC.md`. When manually verifying Task 8 (edit), use a quiz
  created fresh in this plan's own testing, not one with prior attempts,
  to avoid tripping this.
- All new server-side logic that isn't purely UI-rendering must have a
  Vitest unit test written and run **before** the implementation, per
  this project's established TDD flow.

## Review Focus

- Malformed (unparseable) JSON body sent to `POST`/`PUT` — must return
  `400`, not crash with an unhandled `500`. Covered in Task 3 (create
  route) and Task 4 (replace route).
- A `SINGLE_SELECT` question saved with 0 or 2+ correct options — must
  be rejected before any write, since exact-match scoring can never
  award it correctly (or would silently accept two "correct" answers).
  Covered in Task 1 (`validateQuizJson`).
- An authenticated but non-`ADMIN` user calling the admin API routes
  directly (bypassing the UI) — must get `403`, not succeed. Covered in
  Task 3, 4, and 5's route tests.
- A question with `points` omitted — must default to `10`, and that
  default must actually reach the write (validation producing the
  default is not enough if a write path bypassed it). Covered in Task 1
  (`validateQuizJson`'s default) — Tasks 3/4's own `?? 10` fallback in
  `createQuizFromJson`/`replaceQuizFromJson` is defensive but not
  separately tested, since every route call path validates first.
- A question with fewer than 2 options — must be rejected; a quiz
  question can't be meaningfully answered with 0 or 1 choices. Covered
  in Task 1.

---

## File Structure

New/modified files this plan touches:

- `src/lib/quiz/quizJsonSchema.ts` — `validateQuizJson()`: pure function,
  Zod shape/type check + the four semantic rules, no I/O.
- `src/lib/quiz/queries.ts` (modify) — add `getAllQuizzesForAdmin()`
  (Task 2) and `getQuizAsJson()` (Task 8). All Prisma *reads* for admin
  authoring live here, alongside the existing MCQ Core reads.
- `src/lib/quiz/adminQuizzes.ts` — `createQuizFromJson()`,
  `replaceQuizFromJson()`, `deleteQuizById()`. All Prisma *writes* for
  admin authoring live here.
- `src/app/api/admin/quizzes/route.ts` — `POST`, calls
  `createQuizFromJson()`.
- `src/app/api/admin/quizzes/[quizId]/route.ts` — `PUT` (calls
  `replaceQuizFromJson()`) and `DELETE` (calls `deleteQuizById()`).
- `src/app/admin/quizzes/page.tsx` — server component, admin quiz list.
- `src/app/admin/quizzes/DeleteQuizButton.tsx` — client component, the
  list page's delete action.
- `src/app/admin/quizzes/QuizJsonEditor.tsx` — client component, the
  textarea + Save button shared by the new and edit pages.
- `src/app/admin/quizzes/new/page.tsx` — server component, renders
  `QuizJsonEditor` pre-filled with a template, posts to
  `/api/admin/quizzes`.
- `src/app/admin/quizzes/[quizId]/edit/page.tsx` — server component,
  renders `QuizJsonEditor` pre-filled from `getQuizAsJson()`, puts to
  `/api/admin/quizzes/[quizId]`.

---

### Task 1: Quiz JSON validation

**Files:**
- Create: `src/lib/quiz/quizJsonSchema.ts`
- Test: `src/lib/quiz/quizJsonSchema.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, no I/O).
- Produces:
  ```typescript
  export type QuizJsonInput = {
    title: string
    description?: string
    timeLimitSeconds: number
    retakePolicy: 'UNLIMITED_BEST' | 'UNLIMITED_LATEST' | 'SINGLE_ATTEMPT'
    feedbackMode: 'END_ONLY'
    questions: {
      text: string
      type: 'SINGLE_SELECT' | 'MULTI_SELECT'
      points?: number
      options: { text: string; isCorrect: boolean }[]
    }[]
  }
  export type ValidateQuizJsonResult =
    | { ok: true; data: QuizJsonInput }
    | { ok: false; errors: string[] }
  export function validateQuizJson(input: unknown): ValidateQuizJsonResult
  ```
  Tasks 3 and 4 call this before any Prisma write.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/quiz/quizJsonSchema.test.ts
import { describe, it, expect } from 'vitest'
import { validateQuizJson } from './quizJsonSchema'

const validQuiz = {
  title: 'Capitals Quiz',
  description: 'Test your knowledge of world capitals',
  timeLimitSeconds: 300,
  retakePolicy: 'UNLIMITED_BEST',
  feedbackMode: 'END_ONLY',
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

describe('validateQuizJson', () => {
  it('accepts a fully valid quiz', () => {
    const result = validateQuizJson(validQuiz)
    expect(result).toEqual({ ok: true, data: validQuiz })
  })

  it('defaults a missing points to 10', () => {
    const input = {
      ...validQuiz,
      questions: [{ ...validQuiz.questions[0], points: undefined }],
    }
    delete (input.questions[0] as any).points

    const result = validateQuizJson(input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.questions[0].points).toBe(10)
    }
  })

  it('rejects a non-object input', () => {
    const result = validateQuizJson(['not', 'an', 'object'])
    expect(result.ok).toBe(false)
  })

  it('rejects feedbackMode other than END_ONLY', () => {
    const result = validateQuizJson({ ...validQuiz, feedbackMode: 'IMMEDIATE' })
    expect(result.ok).toBe(false)
  })

  it('rejects a quiz with zero questions', () => {
    const result = validateQuizJson({ ...validQuiz, questions: [] })
    expect(result).toEqual({
      ok: false,
      errors: ['Quiz must have at least 1 question.'],
    })
  })

  it('rejects a question with fewer than 2 options', () => {
    const input = {
      ...validQuiz,
      questions: [{ ...validQuiz.questions[0], options: [{ text: 'Only one', isCorrect: true }] }],
    }
    const result = validateQuizJson(input)
    expect(result).toEqual({
      ok: false,
      errors: ['Question 1: must have at least 2 options.'],
    })
  })

  it('rejects a question with zero correct options', () => {
    const input = {
      ...validQuiz,
      questions: [
        {
          ...validQuiz.questions[0],
          options: [
            { text: 'A', isCorrect: false },
            { text: 'B', isCorrect: false },
          ],
        },
      ],
    }
    const result = validateQuizJson(input)
    expect(result).toEqual({
      ok: false,
      errors: ['Question 1: must have at least 1 correct option.'],
    })
  })

  it('rejects a SINGLE_SELECT question with 2 correct options', () => {
    const input = {
      ...validQuiz,
      questions: [
        {
          ...validQuiz.questions[0],
          type: 'SINGLE_SELECT',
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: true },
          ],
        },
      ],
    }
    const result = validateQuizJson(input)
    expect(result).toEqual({
      ok: false,
      errors: ['Question 1: SINGLE_SELECT questions must have exactly 1 correct option.'],
    })
  })

  it('accepts a MULTI_SELECT question with 2 correct options', () => {
    const input = {
      ...validQuiz,
      questions: [
        {
          text: 'Which are primary colors?',
          type: 'MULTI_SELECT',
          points: 20,
          options: [
            { text: 'Red', isCorrect: true },
            { text: 'Green', isCorrect: false },
            { text: 'Blue', isCorrect: true },
          ],
        },
      ],
    }
    const result = validateQuizJson(input)
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/quiz/quizJsonSchema.test.ts`
Expected: FAIL with "Cannot find module './quizJsonSchema'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/quiz/quizJsonSchema.ts
import { z } from 'zod'

const optionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
})

const questionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['SINGLE_SELECT', 'MULTI_SELECT']),
  points: z.number().int().positive().optional(),
  options: z.array(optionSchema),
})

const quizJsonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  timeLimitSeconds: z.number().int().positive(),
  retakePolicy: z.enum(['UNLIMITED_BEST', 'UNLIMITED_LATEST', 'SINGLE_ATTEMPT']),
  feedbackMode: z.literal('END_ONLY'),
  questions: z.array(questionSchema),
})

export type QuizJsonInput = z.infer<typeof quizJsonSchema>

export type ValidateQuizJsonResult =
  | { ok: true; data: QuizJsonInput }
  | { ok: false; errors: string[] }

export function validateQuizJson(input: unknown): ValidateQuizJsonResult {
  const parsed = quizJsonSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    }
  }

  const data = parsed.data
  const errors: string[] = []

  if (data.questions.length < 1) {
    errors.push('Quiz must have at least 1 question.')
  }

  data.questions.forEach((question, index) => {
    if (question.options.length < 2) {
      errors.push(`Question ${index + 1}: must have at least 2 options.`)
      return
    }

    const correctCount = question.options.filter((option) => option.isCorrect).length

    if (correctCount < 1) {
      errors.push(`Question ${index + 1}: must have at least 1 correct option.`)
      return
    }

    if (question.type === 'SINGLE_SELECT' && correctCount !== 1) {
      errors.push(`Question ${index + 1}: SINGLE_SELECT questions must have exactly 1 correct option.`)
    }
  })

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const withDefaults: QuizJsonInput = {
    ...data,
    questions: data.questions.map((question) => ({
      ...question,
      points: question.points ?? 10,
    })),
  }

  return { ok: true, data: withDefaults }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/quiz/quizJsonSchema.test.ts`
Expected: PASS (9/9)

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz/quizJsonSchema.ts src/lib/quiz/quizJsonSchema.test.ts
git commit -m "feat: add quiz JSON validation"
```

---

### Task 2: Admin quiz list query

**Files:**
- Modify: `src/lib/quiz/queries.ts` (add `getAllQuizzesForAdmin`)
- Modify: `src/lib/quiz/queries.test.ts` (add `getAllQuizzesForAdmin` tests;
  extend the `prisma` mock's `quiz` object with nothing new — `findMany`
  already exists there from `getQuizzesWithStatus`)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  ```typescript
  export type AdminQuizListItem = { id: string; title: string; questionCount: number; createdAt: Date }
  export async function getAllQuizzesForAdmin(): Promise<AdminQuizListItem[]>
  ```
  Task 6's list page calls this.

- [ ] **Step 1: Write the failing test**

```typescript
// add to the bottom of src/lib/quiz/queries.test.ts
import { getAllQuizzesForAdmin } from './queries'

describe('getAllQuizzesForAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps each quiz with its question count', async () => {
    vi.mocked(prisma.quiz.findMany).mockResolvedValue([
      {
        id: 'quiz-1',
        title: 'Quiz One',
        createdAt: new Date('2026-09-01T00:00:00Z'),
        _count: { questions: 3 },
      },
      {
        id: 'quiz-2',
        title: 'Quiz Two',
        createdAt: new Date('2026-09-02T00:00:00Z'),
        _count: { questions: 0 },
      },
    ] as any)

    const result = await getAllQuizzesForAdmin()

    expect(result).toEqual([
      { id: 'quiz-1', title: 'Quiz One', questionCount: 3, createdAt: new Date('2026-09-01T00:00:00Z') },
      { id: 'quiz-2', title: 'Quiz Two', questionCount: 0, createdAt: new Date('2026-09-02T00:00:00Z') },
    ])
    expect(prisma.quiz.findMany).toHaveBeenCalledWith({
      include: { _count: { select: { questions: true } } },
      orderBy: { createdAt: 'desc' },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/quiz/queries.test.ts`
Expected: FAIL — `getAllQuizzesForAdmin` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/quiz/queries.ts
export type AdminQuizListItem = { id: string; title: string; questionCount: number; createdAt: Date }

export async function getAllQuizzesForAdmin(): Promise<AdminQuizListItem[]> {
    const quizzes = await prisma.quiz.findMany({
        include: { _count: { select: { questions: true } } },
        orderBy: { createdAt: 'desc' },
    })

    return quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        questionCount: quiz._count.questions,
        createdAt: quiz.createdAt,
    }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/quiz/queries.test.ts`
Expected: PASS (all queries tests, including the new one)

- [ ] **Step 5: Commit**

```bash
git add src/lib/quiz/queries.ts src/lib/quiz/queries.test.ts
git commit -m "feat: add getAllQuizzesForAdmin query"
```

---

### Task 3: Create-quiz logic + API route

**Files:**
- Create: `src/lib/quiz/adminQuizzes.ts` (this task only adds
  `createQuizFromJson`; Tasks 4-5 add more to the same file)
- Create: `src/app/api/admin/quizzes/route.ts`
- Test: `src/lib/quiz/adminQuizzes.test.ts`
- Test: `src/app/api/admin/quizzes/route.test.ts`

**Interfaces:**
- Consumes: `QuizJsonInput` from Task 1, `getCurrentUser()` from MCQ Core
  Task 1 (`src/lib/session.ts`).
- Produces:
  ```typescript
  export async function createQuizFromJson(data: QuizJsonInput): Promise<{ id: string }>
  ```
  The route in this task is what Task 7's `QuizJsonEditor` calls over
  HTTP when creating a new quiz.

- [ ] **Step 1: Write the failing test for `createQuizFromJson`**

```typescript
// src/lib/quiz/adminQuizzes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quiz: { create: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { createQuizFromJson } from './adminQuizzes'

const quizInput = {
  title: 'Capitals Quiz',
  description: 'Test your knowledge',
  timeLimitSeconds: 300,
  retakePolicy: 'UNLIMITED_BEST' as const,
  feedbackMode: 'END_ONLY' as const,
  questions: [
    {
      text: 'What is the capital of France?',
      type: 'SINGLE_SELECT' as const,
      points: 10,
      options: [
        { text: 'Paris', isCorrect: true },
        { text: 'London', isCorrect: false },
      ],
    },
    {
      text: 'Which are in Asia?',
      type: 'MULTI_SELECT' as const,
      points: 10,
      options: [
        { text: 'Japan', isCorrect: true },
        { text: 'Egypt', isCorrect: false },
      ],
    },
  ],
}

describe('createQuizFromJson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates the quiz with nested questions/options and a computed maxScore', async () => {
    vi.mocked(prisma.quiz.create).mockResolvedValue({ id: 'quiz-1' } as any)

    const result = await createQuizFromJson(quizInput)

    expect(result).toEqual({ id: 'quiz-1' })
    expect(prisma.quiz.create).toHaveBeenCalledWith({
      data: {
        title: 'Capitals Quiz',
        description: 'Test your knowledge',
        timeLimitSeconds: 300,
        retakePolicy: 'UNLIMITED_BEST',
        feedbackMode: 'END_ONLY',
        maxScore: 20,
        questions: {
          create: [
            {
              text: 'What is the capital of France?',
              order: 1,
              type: 'SINGLE_SELECT',
              points: 10,
              options: {
                create: [
                  { text: 'Paris', isCorrect: true },
                  { text: 'London', isCorrect: false },
                ],
              },
            },
            {
              text: 'Which are in Asia?',
              order: 2,
              type: 'MULTI_SELECT',
              points: 10,
              options: {
                create: [
                  { text: 'Japan', isCorrect: true },
                  { text: 'Egypt', isCorrect: false },
                ],
              },
            },
          ],
        },
      },
    })
  })

  it('stores null when description is omitted', async () => {
    vi.mocked(prisma.quiz.create).mockResolvedValue({ id: 'quiz-1' } as any)

    await createQuizFromJson({ ...quizInput, description: undefined })

    expect(prisma.quiz.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ description: null }) }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/quiz/adminQuizzes.test.ts`
Expected: FAIL with "Cannot find module './adminQuizzes'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/quiz/adminQuizzes.ts
import { prisma } from '@/lib/prisma'
import type { QuizJsonInput } from './quizJsonSchema'

export async function createQuizFromJson(data: QuizJsonInput): Promise<{ id: string }> {
  const maxScore = data.questions.reduce((sum, question) => sum + (question.points ?? 10), 0)

  const quiz = await prisma.quiz.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      timeLimitSeconds: data.timeLimitSeconds,
      retakePolicy: data.retakePolicy,
      feedbackMode: data.feedbackMode,
      maxScore,
      questions: {
        create: data.questions.map((question, index) => ({
          text: question.text,
          order: index + 1,
          type: question.type,
          points: question.points ?? 10,
          options: {
            create: question.options.map((option) => ({
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          },
        })),
      },
    },
  })

  return { id: quiz.id }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/quiz/adminQuizzes.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Write the failing test for the route**

```typescript
// src/app/api/admin/quizzes/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/quiz/adminQuizzes', () => ({ createQuizFromJson: vi.fn() }))

import { getCurrentUser } from '@/lib/session'
import { createQuizFromJson } from '@/lib/quiz/adminQuizzes'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/quizzes', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = {
  title: 'Capitals Quiz',
  timeLimitSeconds: 300,
  retakePolicy: 'UNLIMITED_BEST',
  feedbackMode: 'END_ONLY',
  questions: [
    {
      text: 'What is the capital of France?',
      type: 'SINGLE_SELECT',
      options: [
        { text: 'Paris', isCorrect: true },
        { text: 'London', isCorrect: false },
      ],
    },
  ],
}

describe('POST /api/admin/quizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when logged in but not an admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 for a malformed JSON body', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    const res = await POST(makeRequest('{not valid json'))
    expect(res.status).toBe(400)
  })

  it('returns 400 with validation errors for a semantically invalid quiz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    const res = await POST(makeRequest({ ...validBody, questions: [] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ errors: ['Quiz must have at least 1 question.'] })
  })

  it('creates the quiz and returns its id on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(createQuizFromJson).mockResolvedValue({ id: 'quiz-1' })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'quiz-1' })
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/app/api/admin/quizzes/route.test.ts`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 7: Write minimal implementation**

```typescript
// src/app/api/admin/quizzes/route.ts
import { getCurrentUser } from '@/lib/session'
import { validateQuizJson } from '@/lib/quiz/quizJsonSchema'
import { createQuizFromJson } from '@/lib/quiz/adminQuizzes'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if (user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden.' }, { status: 403 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const validated = validateQuizJson(json)
  if (!validated.ok) {
    return Response.json({ errors: validated.errors }, { status: 400 })
  }

  const quiz = await createQuizFromJson(validated.data)
  return Response.json({ id: quiz.id }, { status: 201 })
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/app/api/admin/quizzes/route.test.ts`
Expected: PASS (5/5)

- [ ] **Step 9: Commit**

```bash
git add src/lib/quiz/adminQuizzes.ts src/lib/quiz/adminQuizzes.test.ts \
  src/app/api/admin/quizzes/route.ts src/app/api/admin/quizzes/route.test.ts
git commit -m "feat: add create-quiz logic and API route"
```

---

### Task 4: Replace-quiz logic + API route

**Files:**
- Modify: `src/lib/quiz/adminQuizzes.ts` (add `replaceQuizFromJson`)
- Create: `src/app/api/admin/quizzes/[quizId]/route.ts` (this task only
  adds `PUT`; Task 5 adds `DELETE` to the same file)
- Modify: `src/lib/quiz/adminQuizzes.test.ts` (add `replaceQuizFromJson`
  tests; extend the `prisma` mock — see Step 1)
- Test: `src/app/api/admin/quizzes/[quizId]/route.test.ts`

**Interfaces:**
- Consumes: `QuizJsonInput`/`validateQuizJson` from Task 1,
  `getCurrentUser()` from MCQ Core Task 1.
- Produces:
  ```typescript
  export type ReplaceQuizResult = { ok: true } | { ok: false; status: 404; error: string }
  export async function replaceQuizFromJson(quizId: string, data: QuizJsonInput): Promise<ReplaceQuizResult>
  ```
  Task 8's edit page calls the route this task builds.

- [ ] **Step 1: Write the failing test for `replaceQuizFromJson`**

Replace the top-level `vi.mock('@/lib/prisma', ...)` factory in
`src/lib/quiz/adminQuizzes.test.ts` with this extended version (adds
`findUnique`/`update` to `quiz`, a `question` object, and a
`$transaction` that just runs the callback against the same mock so
assertions can inspect the calls made inside it):

```typescript
// replace the existing vi.mock('@/lib/prisma', ...) at the top of
// src/lib/quiz/adminQuizzes.test.ts with this:
vi.mock('@/lib/prisma', () => {
  const prismaMock: any = {
    quiz: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    question: { deleteMany: vi.fn(), create: vi.fn() },
  }
  prismaMock.$transaction = vi.fn((fn: any) => fn(prismaMock))
  return { prisma: prismaMock }
})
```

```typescript
// add to the bottom of src/lib/quiz/adminQuizzes.test.ts
import { replaceQuizFromJson } from './adminQuizzes'

describe('replaceQuizFromJson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the quiz does not exist', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(null)
    const result = await replaceQuizFromJson('missing-quiz', quizInput)
    expect(result).toEqual({ ok: false, status: 404, error: 'Quiz not found.' })
  })

  it('deletes existing questions, updates metadata, and creates the new questions/options', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({ id: 'quiz-1' } as any)

    const result = await replaceQuizFromJson('quiz-1', quizInput)

    expect(result).toEqual({ ok: true })
    expect(prisma.question.deleteMany).toHaveBeenCalledWith({ where: { quizId: 'quiz-1' } })
    expect(prisma.quiz.update).toHaveBeenCalledWith({
      where: { id: 'quiz-1' },
      data: {
        title: 'Capitals Quiz',
        description: 'Test your knowledge',
        timeLimitSeconds: 300,
        retakePolicy: 'UNLIMITED_BEST',
        feedbackMode: 'END_ONLY',
        maxScore: 20,
      },
    })
    expect(prisma.question.create).toHaveBeenCalledWith({
      data: {
        quizId: 'quiz-1',
        text: 'What is the capital of France?',
        order: 1,
        type: 'SINGLE_SELECT',
        points: 10,
        options: {
          create: [
            { text: 'Paris', isCorrect: true },
            { text: 'London', isCorrect: false },
          ],
        },
      },
    })
    expect(prisma.question.create).toHaveBeenCalledWith({
      data: {
        quizId: 'quiz-1',
        text: 'Which are in Asia?',
        order: 2,
        type: 'MULTI_SELECT',
        points: 10,
        options: {
          create: [
            { text: 'Japan', isCorrect: true },
            { text: 'Egypt', isCorrect: false },
          ],
        },
      },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/quiz/adminQuizzes.test.ts`
Expected: FAIL — `replaceQuizFromJson` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/quiz/adminQuizzes.ts
export type ReplaceQuizResult = { ok: true } | { ok: false; status: 404; error: string }

export async function replaceQuizFromJson(
  quizId: string,
  data: QuizJsonInput,
): Promise<ReplaceQuizResult> {
  const existing = await prisma.quiz.findUnique({ where: { id: quizId } })
  if (!existing) {
    return { ok: false, status: 404, error: 'Quiz not found.' }
  }

  const maxScore = data.questions.reduce((sum, question) => sum + (question.points ?? 10), 0)

  await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { quizId } })

    await tx.quiz.update({
      where: { id: quizId },
      data: {
        title: data.title,
        description: data.description ?? null,
        timeLimitSeconds: data.timeLimitSeconds,
        retakePolicy: data.retakePolicy,
        feedbackMode: data.feedbackMode,
        maxScore,
      },
    })

    for (const [index, question] of data.questions.entries()) {
      await tx.question.create({
        data: {
          quizId,
          text: question.text,
          order: index + 1,
          type: question.type,
          points: question.points ?? 10,
          options: {
            create: question.options.map((option) => ({
              text: option.text,
              isCorrect: option.isCorrect,
            })),
          },
        },
      })
    }
  })

  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/quiz/adminQuizzes.test.ts`
Expected: PASS (all `createQuizFromJson` + `replaceQuizFromJson` tests)

- [ ] **Step 5: Write the failing test for the route**

```typescript
// src/app/api/admin/quizzes/[quizId]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/quiz/adminQuizzes', () => ({
  replaceQuizFromJson: vi.fn(),
  deleteQuizById: vi.fn(),
}))

import { getCurrentUser } from '@/lib/session'
import { replaceQuizFromJson } from '@/lib/quiz/adminQuizzes'
import { PUT } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/quizzes/quiz-1', {
    method: 'PUT',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = {
  title: 'Capitals Quiz',
  timeLimitSeconds: 300,
  retakePolicy: 'UNLIMITED_BEST',
  feedbackMode: 'END_ONLY',
  questions: [
    {
      text: 'What is the capital of France?',
      type: 'SINGLE_SELECT',
      options: [
        { text: 'Paris', isCorrect: true },
        { text: 'London', isCorrect: false },
      ],
    },
  ],
}

describe('PUT /api/admin/quizzes/[quizId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const res = await PUT(makeRequest(validBody), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when logged in but not an admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    const res = await PUT(makeRequest(validBody), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 400 for a malformed JSON body', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    const res = await PUT(makeRequest('{not valid json'), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when replaceQuizFromJson reports the quiz missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(replaceQuizFromJson).mockResolvedValue({ ok: false, status: 404, error: 'Quiz not found.' })

    const res = await PUT(makeRequest(validBody), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Quiz not found.' })
  })

  it('replaces the quiz and returns 200 on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(replaceQuizFromJson).mockResolvedValue({ ok: true })

    const res = await PUT(makeRequest(validBody), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(200)
    expect(replaceQuizFromJson).toHaveBeenCalledWith('quiz-1', expect.objectContaining({ title: 'Capitals Quiz' }))
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run "src/app/api/admin/quizzes/[quizId]/route.test.ts"`
Expected: FAIL with "Cannot find module './route'"

- [ ] **Step 7: Write minimal implementation**

```typescript
// src/app/api/admin/quizzes/[quizId]/route.ts
import { getCurrentUser } from '@/lib/session'
import { validateQuizJson } from '@/lib/quiz/quizJsonSchema'
import { replaceQuizFromJson } from '@/lib/quiz/adminQuizzes'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if (user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden.' }, { status: 403 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const validated = validateQuizJson(json)
  if (!validated.ok) {
    return Response.json({ errors: validated.errors }, { status: 400 })
  }

  const { quizId } = await params
  const result = await replaceQuizFromJson(quizId, validated.data)

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  return Response.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run "src/app/api/admin/quizzes/[quizId]/route.test.ts"`
Expected: PASS (5/5)

- [ ] **Step 9: Commit**

```bash
git add src/lib/quiz/adminQuizzes.ts src/lib/quiz/adminQuizzes.test.ts \
  "src/app/api/admin/quizzes/[quizId]/route.ts" \
  "src/app/api/admin/quizzes/[quizId]/route.test.ts"
git commit -m "feat: add replace-quiz logic and API route"
```

---

### Task 5: Delete-quiz logic + API route

**Files:**
- Modify: `src/lib/quiz/adminQuizzes.ts` (add `deleteQuizById`)
- Modify: `src/app/api/admin/quizzes/[quizId]/route.ts` (add `DELETE`)
- Modify: `src/lib/quiz/adminQuizzes.test.ts` (add `deleteQuizById` tests;
  extend the `prisma` mock with `quiz.delete` — see Step 1)
- Modify: `src/app/api/admin/quizzes/[quizId]/route.test.ts` (add
  `DELETE` route tests)

**Interfaces:**
- Consumes: `getCurrentUser()` from MCQ Core Task 1.
- Produces:
  ```typescript
  export type DeleteQuizResult = { ok: true } | { ok: false; status: 404; error: string }
  export async function deleteQuizById(quizId: string): Promise<DeleteQuizResult>
  ```
  Task 6's `DeleteQuizButton` calls the route this task builds.

- [ ] **Step 1: Write the failing test for `deleteQuizById`**

Add `delete: vi.fn()` to the `quiz` object in the `vi.mock('@/lib/prisma', ...)`
factory at the top of `src/lib/quiz/adminQuizzes.test.ts`:

```typescript
// the quiz object inside the vi.mock('@/lib/prisma', ...) factory becomes:
quiz: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
```

```typescript
// add to the bottom of src/lib/quiz/adminQuizzes.test.ts
import { deleteQuizById } from './adminQuizzes'

describe('deleteQuizById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the quiz does not exist', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(null)
    const result = await deleteQuizById('missing-quiz')
    expect(result).toEqual({ ok: false, status: 404, error: 'Quiz not found.' })
  })

  it('deletes the quiz when it exists', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({ id: 'quiz-1' } as any)

    const result = await deleteQuizById('quiz-1')

    expect(result).toEqual({ ok: true })
    expect(prisma.quiz.delete).toHaveBeenCalledWith({ where: { id: 'quiz-1' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/quiz/adminQuizzes.test.ts`
Expected: FAIL — `deleteQuizById` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/quiz/adminQuizzes.ts
export type DeleteQuizResult = { ok: true } | { ok: false; status: 404; error: string }

export async function deleteQuizById(quizId: string): Promise<DeleteQuizResult> {
  const existing = await prisma.quiz.findUnique({ where: { id: quizId } })
  if (!existing) {
    return { ok: false, status: 404, error: 'Quiz not found.' }
  }

  await prisma.quiz.delete({ where: { id: quizId } })
  return { ok: true }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/quiz/adminQuizzes.test.ts`
Expected: PASS (all `createQuizFromJson` + `replaceQuizFromJson` +
`deleteQuizById` tests)

- [ ] **Step 5: Write the failing test for the DELETE route**

First, update the existing `vi.mock('@/lib/quiz/adminQuizzes', ...)`
factory at the top of `src/app/api/admin/quizzes/[quizId]/route.test.ts`
(it currently only mocks `replaceQuizFromJson` from Task 4) to also
mock `deleteQuizById`:

```typescript
// the vi.mock('@/lib/quiz/adminQuizzes', ...) factory near the top of
// src/app/api/admin/quizzes/[quizId]/route.test.ts becomes:
vi.mock('@/lib/quiz/adminQuizzes', () => ({
  replaceQuizFromJson: vi.fn(),
  deleteQuizById: vi.fn(),
}))
```

Then add the new test code:

```typescript
// add to src/app/api/admin/quizzes/[quizId]/route.test.ts
import { deleteQuizById } from '@/lib/quiz/adminQuizzes'
import { DELETE } from './route'

function makeDeleteRequest() {
  return new Request('http://localhost/api/admin/quizzes/quiz-1', { method: 'DELETE' })
}

describe('DELETE /api/admin/quizzes/[quizId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when logged in but not an admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 when deleteQuizById reports the quiz missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(deleteQuizById).mockResolvedValue({ ok: false, status: 404, error: 'Quiz not found.' })

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(404)
  })

  it('deletes the quiz and returns 204 on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(deleteQuizById).mockResolvedValue({ ok: true })

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(204)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run "src/app/api/admin/quizzes/[quizId]/route.test.ts"`
Expected: FAIL — `DELETE` is not exported yet.

- [ ] **Step 7: Write minimal implementation**

```typescript
// append to src/app/api/admin/quizzes/[quizId]/route.ts
import { deleteQuizById } from '@/lib/quiz/adminQuizzes'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if (user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { quizId } = await params
  const result = await deleteQuizById(quizId)

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  return new Response(null, { status: 204 })
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run "src/app/api/admin/quizzes/[quizId]/route.test.ts"`
Expected: PASS (9/9 — 5 from `PUT`, 4 from `DELETE`)

- [ ] **Step 9: Commit**

```bash
git add src/lib/quiz/adminQuizzes.ts src/lib/quiz/adminQuizzes.test.ts \
  "src/app/api/admin/quizzes/[quizId]/route.ts" \
  "src/app/api/admin/quizzes/[quizId]/route.test.ts"
git commit -m "feat: add delete-quiz logic and API route"
```

---

### Task 6: Admin quiz list page

**Files:**
- Create: `src/app/admin/quizzes/page.tsx`
- Create: `src/app/admin/quizzes/DeleteQuizButton.tsx`

**Interfaces:**
- Consumes: `getCurrentUser()` (MCQ Core Task 1), `getAllQuizzesForAdmin()`
  (Task 2), `DELETE /api/admin/quizzes/[quizId]` (Task 5).
- Produces: nothing consumed by a later task — this is the entry point
  admins land on, linking out to Task 7 (new) and Task 8 (edit).

- [ ] **Step 1: Write the delete button client component**

```typescript
// src/app/admin/quizzes/DeleteQuizButton.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteQuizButton({ quizId }: { quizId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!window.confirm('Delete this quiz? This cannot be undone.')) {
      return
    }

    setPending(true)
    setError(null)

    const res = await fetch(`/api/admin/quizzes/${quizId}`, { method: 'DELETE' })

    if (res.ok) {
      router.refresh()
      return
    }

    setPending(false)
    const body = await res.json()
    setError(body.error ?? 'Could not delete the quiz.')
  }

  return (
    <div>
      <button onClick={handleClick} disabled={pending}>
        {pending ? 'Deleting...' : 'Delete'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Write the list page**

```typescript
// src/app/admin/quizzes/page.tsx
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getAllQuizzesForAdmin } from '@/lib/quiz/queries'
import { DeleteQuizButton } from './DeleteQuizButton'

export default async function AdminQuizzesPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  if (user.role !== 'ADMIN') {
    notFound()
  }

  const quizzes = await getAllQuizzesForAdmin()

  return (
    <main>
      <h1>Admin: Quizzes</h1>
      <Link href="/admin/quizzes/new">New Quiz</Link>
      <ul>
        {quizzes.map((quiz) => (
          <li key={quiz.id}>
            <span>{quiz.title}</span>
            <span>
              {' '}
              — {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
            </span>
            <Link href={`/admin/quizzes/${quiz.id}/edit`}>Edit</Link>
            <DeleteQuizButton quizId={quiz.id} />
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 3: Manually verify in the browser**

Run `npm run dev`, promote your test account's `role` to `ADMIN` in
Prisma Studio (`npx prisma studio`), log out and back in (the role is
baked into the JWT at login, so a fresh session is required), then
visit `/admin/quizzes`. Confirm: the existing quiz(zes) from MCQ Core
manual testing render with their question counts, "New Quiz" link is
present, "Edit" links to `/admin/quizzes/[quizId]/edit` (will 404 for
now — Task 8 not built yet). Separately, log in as a non-`ADMIN` user
and confirm visiting `/admin/quizzes` redirects to `/login` (middleware
still enforces this even though the page's own `notFound()` check is
belt-and-suspenders).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/quizzes/page.tsx src/app/admin/quizzes/DeleteQuizButton.tsx
git commit -m "feat: add admin quiz list page with delete action"
```

---

### Task 7: Quiz JSON editor + New Quiz page

**Files:**
- Create: `src/app/admin/quizzes/QuizJsonEditor.tsx`
- Create: `src/app/admin/quizzes/new/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser()` (MCQ Core Task 1),
  `POST /api/admin/quizzes` (Task 3).
- Produces: `QuizJsonEditor` component, reused as-is by Task 8's edit
  page (imported via a relative path one level further up).

- [ ] **Step 1: Write the shared editor component**

```typescript
// src/app/admin/quizzes/QuizJsonEditor.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  initialJson: string
  submitUrl: string
  method: 'POST' | 'PUT'
}

export function QuizJsonEditor({ initialJson, submitUrl, method }: Props) {
  const router = useRouter()
  const [text, setText] = useState(initialJson)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    setErrors([])

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      setErrors(['Invalid JSON syntax.'])
      return
    }

    setSubmitting(true)

    const res = await fetch(submitUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    })

    setSubmitting(false)

    if (res.ok) {
      router.push('/admin/quizzes')
      return
    }

    const body = await res.json()
    setErrors(body.errors ?? [body.error ?? 'Could not save the quiz.'])
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={30}
        cols={80}
      />
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}
      <button onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write the new-quiz page**

```typescript
// src/app/admin/quizzes/new/page.tsx
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { QuizJsonEditor } from '../QuizJsonEditor'

const TEMPLATE = JSON.stringify(
  {
    title: 'New Quiz',
    description: '',
    timeLimitSeconds: 300,
    retakePolicy: 'UNLIMITED_BEST',
    feedbackMode: 'END_ONLY',
    questions: [
      {
        text: 'Sample question?',
        type: 'SINGLE_SELECT',
        points: 10,
        options: [
          { text: 'Correct answer', isCorrect: true },
          { text: 'Wrong answer', isCorrect: false },
        ],
      },
    ],
  },
  null,
  2,
)

export default async function NewQuizPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  if (user.role !== 'ADMIN') {
    notFound()
  }

  return (
    <main>
      <h1>New Quiz</h1>
      <QuizJsonEditor initialJson={TEMPLATE} submitUrl="/api/admin/quizzes" method="POST" />
    </main>
  )
}
```

- [ ] **Step 3: Manually verify in the browser**

As the `ADMIN` test account, visit `/admin/quizzes/new`. Confirm the
textarea is pre-filled with the template. First, try saving with a
broken semantic rule (e.g. change the `SINGLE_SELECT` question to have
2 `isCorrect: true` options) and confirm the error list renders above
the textarea without your edits being lost. Then fix it and Save;
confirm it redirects to `/admin/quizzes` and the new quiz appears in the
list with the right question count.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/quizzes/QuizJsonEditor.tsx src/app/admin/quizzes/new/page.tsx
git commit -m "feat: add quiz JSON editor and new-quiz page"
```

---

### Task 8: Edit-quiz page

**Files:**
- Modify: `src/lib/quiz/queries.ts` (add `getQuizAsJson`)
- Modify: `src/lib/quiz/queries.test.ts` (add `getQuizAsJson` tests)
- Create: `src/app/admin/quizzes/[quizId]/edit/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser()` (MCQ Core Task 1), `QuizJsonEditor` (Task
  7), `PUT /api/admin/quizzes/[quizId]` (Task 4).
- Produces:
  ```typescript
  export type QuizJsonData = {
    title: string
    description?: string
    timeLimitSeconds: number
    retakePolicy: 'UNLIMITED_BEST' | 'UNLIMITED_LATEST' | 'SINGLE_ATTEMPT'
    feedbackMode: 'END_ONLY' | 'IMMEDIATE'
    questions: {
      text: string
      type: 'SINGLE_SELECT' | 'MULTI_SELECT'
      points: number
      options: { text: string; isCorrect: boolean }[]
    }[]
  }
  export async function getQuizAsJson(quizId: string): Promise<QuizJsonData | null>
  ```
  Nothing later depends on this — it's the last task in this plan.

- [ ] **Step 1: Write the failing test**

```typescript
// add to the bottom of src/lib/quiz/queries.test.ts
import { getQuizAsJson } from './queries'

describe('getQuizAsJson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when the quiz does not exist', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(null)
    const result = await getQuizAsJson('missing-quiz')
    expect(result).toBeNull()
  })

  it('reverse-maps the quiz into the admin JSON shape, sorted by order', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      title: 'Quiz One',
      description: null,
      timeLimitSeconds: 300,
      retakePolicy: 'UNLIMITED_BEST',
      feedbackMode: 'END_ONLY',
      questions: [
        {
          text: 'Second?',
          order: 2,
          type: 'SINGLE_SELECT',
          points: 20,
          options: [{ text: 'C', isCorrect: true }],
        },
        {
          text: 'First?',
          order: 1,
          type: 'SINGLE_SELECT',
          points: 10,
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
          ],
        },
      ],
    } as any)

    const result = await getQuizAsJson('quiz-1')

    expect(result).toEqual({
      title: 'Quiz One',
      description: undefined,
      timeLimitSeconds: 300,
      retakePolicy: 'UNLIMITED_BEST',
      feedbackMode: 'END_ONLY',
      questions: [
        {
          text: 'First?',
          type: 'SINGLE_SELECT',
          points: 10,
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
          ],
        },
        {
          text: 'Second?',
          type: 'SINGLE_SELECT',
          points: 20,
          options: [{ text: 'C', isCorrect: true }],
        },
      ],
    })
    expect(prisma.quiz.findUnique).toHaveBeenCalledWith({
      where: { id: 'quiz-1' },
      include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/quiz/queries.test.ts`
Expected: FAIL — `getQuizAsJson` is not exported yet.

- [ ] **Step 3: Write minimal implementation**

```typescript
// append to src/lib/quiz/queries.ts
export type QuizJsonData = {
    title: string
    description?: string
    timeLimitSeconds: number
    retakePolicy: 'UNLIMITED_BEST' | 'UNLIMITED_LATEST' | 'SINGLE_ATTEMPT'
    feedbackMode: 'END_ONLY' | 'IMMEDIATE'
    questions: {
        text: string
        type: 'SINGLE_SELECT' | 'MULTI_SELECT'
        points: number
        options: { text: string; isCorrect: boolean }[]
    }[]
}

export async function getQuizAsJson(quizId: string): Promise<QuizJsonData | null> {
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
    })

    if (!quiz) {
        return null
    }

    return {
        title: quiz.title,
        description: quiz.description ?? undefined,
        timeLimitSeconds: quiz.timeLimitSeconds,
        retakePolicy: quiz.retakePolicy,
        feedbackMode: quiz.feedbackMode,
        questions: quiz.questions.map((question) => ({
            text: question.text,
            type: question.type,
            points: question.points,
            options: question.options.map((option) => ({
                text: option.text,
                isCorrect: option.isCorrect,
            })),
        })),
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/quiz/queries.test.ts`
Expected: PASS (all queries tests, including the two new ones)

- [ ] **Step 5: Commit the query logic**

```bash
git add src/lib/quiz/queries.ts src/lib/quiz/queries.test.ts
git commit -m "feat: add getQuizAsJson query"
```

- [ ] **Step 6: Write the edit page**

```typescript
// src/app/admin/quizzes/[quizId]/edit/page.tsx
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getQuizAsJson } from '@/lib/quiz/queries'
import { QuizJsonEditor } from '../../QuizJsonEditor'

export default async function EditQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  if (user.role !== 'ADMIN') {
    notFound()
  }

  const { quizId } = await params
  const quizJson = await getQuizAsJson(quizId)
  if (!quizJson) {
    notFound()
  }

  return (
    <main>
      <h1>Edit Quiz</h1>
      <QuizJsonEditor
        initialJson={JSON.stringify(quizJson, null, 2)}
        submitUrl={`/api/admin/quizzes/${quizId}`}
        method="PUT"
      />
    </main>
  )
}
```

- [ ] **Step 7: Manually verify in the browser end to end**

Use the quiz you created in Task 7's manual test (fresh, no attempts
yet) — **not** the "Sample Quiz" from MCQ Core manual testing, since
that one already has submitted attempts and will hit the FK-violation
backlog limitation documented in Global Constraints above. Visit
`/admin/quizzes/[quizId]/edit`, confirm the textarea is pre-filled with
that quiz's current JSON (metadata + questions, pretty-printed, no IDs
anywhere). Edit something (e.g. add a second question, or change the
title), Save, confirm it redirects to `/admin/quizzes` and the change is
reflected (title/question count updated). Revisit the edit page and
confirm the change persisted. Then, separately, visit
`/quizzes/[quizId]/take/...` (start a fresh attempt from `/quizzes`) to
confirm the learner-facing pages still work correctly against the
replaced question set.

- [ ] **Step 8: Commit**

```bash
git add "src/app/admin/quizzes/[quizId]/edit/page.tsx"
git commit -m "feat: add edit-quiz page"
```
