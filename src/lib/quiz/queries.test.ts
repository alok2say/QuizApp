import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quiz: { findMany: vi.fn(), findUnique: vi.fn() },
    attempt: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getQuizzesWithStatus,
  getQuizForTaking,
  getAttemptResult,
  getAllQuizzesForAdmin,
  getQuizAsJson,
  getLeaderboard,
} from './queries'

describe('getQuizzesWithStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps each quiz with its most recent attempt for this user, or null', async () => {
    vi.mocked(prisma.quiz.findMany).mockResolvedValue([
      {
        id: 'quiz-1',
        title: 'Quiz One',
        description: 'First quiz',
        timeLimitSeconds: 300,
        retakePolicy: 'SINGLE_ATTEMPT',
        attempts: [{ id: 'attempt-1', score: 10, submittedAt: new Date('2026-08-20T00:00:00Z') }],
      },
      {
        id: 'quiz-2',
        title: 'Quiz Two',
        description: null,
        timeLimitSeconds: 60,
        retakePolicy: 'UNLIMITED_BEST',
        attempts: [],
      },
    ] as never)

    const result = await getQuizzesWithStatus('user-1')

    expect(result).toEqual([
      {
        id: 'quiz-1',
        title: 'Quiz One',
        description: 'First quiz',
        timeLimitSeconds: 300,
        retakePolicy: 'SINGLE_ATTEMPT',
        latestAttempt: { id: 'attempt-1', score: 10, submittedAt: new Date('2026-08-20T00:00:00Z') },
      },
      {
        id: 'quiz-2',
        title: 'Quiz Two',
        description: null,
        timeLimitSeconds: 60,
        retakePolicy: 'UNLIMITED_BEST',
        latestAttempt: null,
      },
    ])
    expect(prisma.quiz.findMany).toHaveBeenCalledWith({
      include: {
        attempts: {
          where: { userId: 'user-1' },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    })
  })
})

describe('getQuizForTaking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the attempt does not exist', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(null)
    const result = await getQuizForTaking('quiz-1', 'attempt-1', 'user-1')
    expect(result).toEqual({ ok: false, status: 404, error: 'Attempt not found.' })
  })

  it('returns 403 when the attempt belongs to a different user', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'someone-else',
      submittedAt: null,
      startedAt: new Date(),
      quiz: { title: 'Q', timeLimitSeconds: 60, questions: [] },
    } as never)
    const result = await getQuizForTaking('quiz-1', 'attempt-1', 'user-1')
    expect(result).toEqual({ ok: false, status: 403, error: 'Forbidden.' })
  })

  it('returns 409 when the attempt is already submitted', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      submittedAt: new Date(),
      startedAt: new Date(),
      quiz: { title: 'Q', timeLimitSeconds: 60, questions: [] },
    } as never)
    const result = await getQuizForTaking('quiz-1', 'attempt-1', 'user-1')
    expect(result).toEqual({ ok: false, status: 409, error: 'This attempt was already submitted.' })
  })

  it('strips isCorrect from options and sorts questions by order', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      submittedAt: null,
      startedAt: new Date('2026-08-22T10:00:00Z'),
      quiz: {
        title: 'Quiz One',
        timeLimitSeconds: 300,
        questions: [
          {
            id: 'q2',
            text: 'Second?',
            order: 2,
            type: 'SINGLE_SELECT',
            options: [{ id: 'c', text: 'C', isCorrect: true }],
          },
          {
            id: 'q1',
            text: 'First?',
            order: 1,
            type: 'SINGLE_SELECT',
            options: [
              { id: 'a', text: 'A', isCorrect: true },
              { id: 'b', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
    } as never)

    const result = await getQuizForTaking('quiz-1', 'attempt-1', 'user-1')

    expect(result).toEqual({
      ok: true,
      quizTitle: 'Quiz One',
      timeLimitSeconds: 300,
      startedAt: new Date('2026-08-22T10:00:00Z'),
      questions: [
        {
          id: 'q1',
          text: 'First?',
          order: 1,
          type: 'SINGLE_SELECT',
          options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
        },
        {
          id: 'q2',
          text: 'Second?',
          order: 2,
          type: 'SINGLE_SELECT',
          options: [{ id: 'c', text: 'C' }],
        },
      ],
    })
  })
})

describe('getAttemptResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the attempt does not exist', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(null)
    const result = await getAttemptResult('attempt-1', 'user-1')
    expect(result).toEqual({ ok: false, status: 404, error: 'Attempt not found.' })
  })

  it('returns 403 when the attempt belongs to a different user', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      userId: 'someone-else',
      submittedAt: new Date(),
      score: 0,
      quiz: { title: 'Q', questions: [] },
      answers: [],
    } as never)
    const result = await getAttemptResult('attempt-1', 'user-1')
    expect(result).toEqual({ ok: false, status: 403, error: 'Forbidden.' })
  })

  it('returns 409 when the attempt has not been submitted yet', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      userId: 'user-1',
      submittedAt: null,
      score: 0,
      quiz: { title: 'Q', questions: [] },
      answers: [],
    } as never)
    const result = await getAttemptResult('attempt-1', 'user-1')
    expect(result).toEqual({ ok: false, status: 409, error: 'This attempt has not been submitted yet.' })
  })

  it('builds a per-question breakdown in question order, with quiz id and retake policy', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      userId: 'user-1',
      submittedAt: new Date(),
      score: 10,
      quiz: {
        id: 'quiz-1',
        title: 'Quiz One',
        retakePolicy: 'UNLIMITED_BEST',
        questions: [
          {
            id: 'q2',
            text: 'Second?',
            order: 2,
            type: 'MULTI_SELECT',
            points: 5,
            options: [{ id: 'c', text: 'C', isCorrect: true }],
          },
          {
            id: 'q1',
            text: 'First?',
            order: 1,
            type: 'SINGLE_SELECT',
            points: 10,
            options: [
              { id: 'a', text: 'A', isCorrect: true },
              { id: 'b', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
      answers: [{ questionId: 'q1', selectedOptionIds: ['a'], isCorrect: true, pointsAwarded: 10 }],
    } as never)

    const result = await getAttemptResult('attempt-1', 'user-1')

    expect(result).toEqual({
      ok: true,
      quizId: 'quiz-1',
      quizTitle: 'Quiz One',
      retakePolicy: 'UNLIMITED_BEST',
      score: 10,
      maxScore: 15,
      questions: [
        {
          id: 'q1',
          text: 'First?',
          type: 'SINGLE_SELECT',
          isCorrect: true,
          pointsAwarded: 10,
          points: 10,
          options: [
            { id: 'a', text: 'A', isCorrect: true, wasSelected: true },
            { id: 'b', text: 'B', isCorrect: false, wasSelected: false },
          ],
        },
        {
          id: 'q2',
          text: 'Second?',
          type: 'MULTI_SELECT',
          isCorrect: false,
          pointsAwarded: 0,
          points: 5,
          options: [{ id: 'c', text: 'C', isCorrect: true, wasSelected: false }],
        },
      ],
    })
  })
})

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
    ] as never)

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
      leaderboardSize: 10,
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
    } as never)

    const result = await getQuizAsJson('quiz-1')

    expect(result).toEqual({
      title: 'Quiz One',
      description: undefined,
      timeLimitSeconds: 300,
      retakePolicy: 'UNLIMITED_BEST',
      feedbackMode: 'END_ONLY',
      leaderboardSize: 10,
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
    } as never)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 20, completionSeconds: 100, submittedAt: new Date('2026-09-01T00:00:00Z'), name: 'Alice' }),
      eligibleAttempt({ userId: 'user-b', score: 30, completionSeconds: 50, submittedAt: new Date('2026-09-02T00:00:00Z'), name: 'Bob' }),
      // ties user-c and user-d on both score and completionSeconds — submittedAt must break it
      eligibleAttempt({ userId: 'user-c', score: 30, completionSeconds: 50, submittedAt: new Date('2026-09-03T00:00:00Z'), name: 'Carol' }),
      eligibleAttempt({ userId: 'user-d', score: 30, completionSeconds: 50, submittedAt: new Date('2026-09-01T12:00:00Z'), name: 'Dave' }),
    ] as never)

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
    } as never)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10, name: 'Alice' }),
      eligibleAttempt({ userId: 'user-b', score: 5, name: null, email: 'bob.smith@example.com' }),
    ] as never)

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
    } as never)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10 }),
      eligibleAttempt({ userId: 'user-b', score: 5 }),
    ] as never)

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
    } as never)
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
    } as never)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10 }),
      eligibleAttempt({ userId: 'user-b', score: 5 }),
    ] as never)

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
    } as never)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10 }),
    ] as never)

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
    } as never)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      eligibleAttempt({ userId: 'user-a', score: 10 }),
    ] as never)

    const result = await getLeaderboard('quiz-1', 'user-never-attempted')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.hasAttempted).toBe(false)
      expect(result.ownRank).toBeNull()
    }
  })
})
