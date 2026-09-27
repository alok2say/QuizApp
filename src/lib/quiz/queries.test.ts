import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quiz: { findMany: vi.fn(), findUnique: vi.fn() },
    attempt: { findUnique: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  getQuizzesWithStatus,
  getQuizForTaking,
  getAttemptResult,
  getAllQuizzesForAdmin,
  getQuizAsJson,
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
    ] as any)

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
    } as any)
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
    } as any)
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
    } as any)

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
    } as any)
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
    } as any)
    const result = await getAttemptResult('attempt-1', 'user-1')
    expect(result).toEqual({ ok: false, status: 409, error: 'This attempt has not been submitted yet.' })
  })

  it('builds a per-question breakdown revealing correctness and selections', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      userId: 'user-1',
      submittedAt: new Date(),
      score: 10,
      quiz: {
        title: 'Quiz One',
        questions: [
          {
            id: 'q1',
            text: 'First?',
            points: 10,
            options: [
              { id: 'a', text: 'A', isCorrect: true },
              { id: 'b', text: 'B', isCorrect: false },
            ],
          },
        ],
      },
      answers: [{ questionId: 'q1', selectedOptionIds: ['a'], isCorrect: true, pointsAwarded: 10 }],
    } as any)

    const result = await getAttemptResult('attempt-1', 'user-1')

    expect(result).toEqual({
      ok: true,
      quizTitle: 'Quiz One',
      score: 10,
      maxScore: 10,
      questions: [
        {
          id: 'q1',
          text: 'First?',
          isCorrect: true,
          pointsAwarded: 10,
          points: 10,
          options: [
            { id: 'a', text: 'A', isCorrect: true, wasSelected: true },
            { id: 'b', text: 'B', isCorrect: false, wasSelected: false },
          ],
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
