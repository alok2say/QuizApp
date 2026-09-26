import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quiz: { findUnique: vi.fn() },
    attempt: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    attemptAnswer: { createMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { startAttempt, submitAttempt } from './attempts'

describe('startAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the quiz does not exist', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue(null)
    const result = await startAttempt('missing-quiz', 'user-1')
    expect(result).toEqual({ ok: false, status: 404, error: 'Quiz not found.' })
  })

  it('creates a new attempt when the quiz has never been attempted', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      id: 'quiz-1',
      retakePolicy: 'SINGLE_ATTEMPT',
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([])
    vi.mocked(prisma.attempt.create).mockResolvedValue({ id: 'attempt-1' } as any)

    const result = await startAttempt('quiz-1', 'user-1')

    expect(result).toEqual({ ok: true, attemptId: 'attempt-1' })
    expect(prisma.attempt.create).toHaveBeenCalledWith({
      data: { quizId: 'quiz-1', userId: 'user-1' },
    })
  })

  it('blocks a SINGLE_ATTEMPT retake and points at the unsubmitted attempt to resume', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      id: 'quiz-1',
      retakePolicy: 'SINGLE_ATTEMPT',
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      { id: 'attempt-1', submittedAt: null },
    ] as any)

    const result = await startAttempt('quiz-1', 'user-1')

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'You have already attempted this quiz.',
      attemptId: 'attempt-1',
      resume: true,
    })
    expect(prisma.attempt.create).not.toHaveBeenCalled()
  })

  it('blocks a SINGLE_ATTEMPT retake and points at the submitted attempt result', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      id: 'quiz-1',
      retakePolicy: 'SINGLE_ATTEMPT',
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      { id: 'attempt-1', submittedAt: new Date() },
    ] as any)

    const result = await startAttempt('quiz-1', 'user-1')

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'You have already attempted this quiz.',
      attemptId: 'attempt-1',
      resume: false,
    })
  })

  it('allows a new attempt under UNLIMITED_BEST even with a prior submitted attempt', async () => {
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({
      id: 'quiz-1',
      retakePolicy: 'UNLIMITED_BEST',
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      { id: 'attempt-1', submittedAt: new Date() },
    ] as any)
    vi.mocked(prisma.attempt.create).mockResolvedValue({ id: 'attempt-2' } as any)

    const result = await startAttempt('quiz-1', 'user-1')

    expect(result).toEqual({ ok: true, attemptId: 'attempt-2' })
  })
})

const quizWithQuestions = {
  id: 'quiz-1',
  retakePolicy: 'SINGLE_ATTEMPT',
  questions: [
    {
      id: 'q1',
      points: 10,
      options: [
        { id: 'a', isCorrect: true },
        { id: 'b', isCorrect: false },
      ],
    },
    {
      id: 'q2',
      points: 20,
      options: [
        { id: 'c', isCorrect: true },
        { id: 'd', isCorrect: true },
      ],
    },
  ],
}

describe('submitAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the attempt does not exist', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue(null)
    const result = await submitAttempt('missing', 'user-1', [])
    expect(result).toEqual({ ok: false, status: 404, error: 'Attempt not found.' })
  })

  it('returns 403 when the attempt belongs to a different user', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      userId: 'someone-else',
      submittedAt: null,
      startedAt: new Date(),
      quiz: quizWithQuestions,
    } as any)
    const result = await submitAttempt('attempt-1', 'user-1', [])
    expect(result).toEqual({ ok: false, status: 403, error: 'Forbidden.' })
  })

  it('returns 409 when the attempt is already submitted', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      userId: 'user-1',
      submittedAt: new Date(),
      startedAt: new Date(),
      quiz: quizWithQuestions,
    } as any)
    const result = await submitAttempt('attempt-1', 'user-1', [])
    expect(result).toEqual({ ok: false, status: 409, error: 'Attempt already submitted.' })
  })

  it('scores all questions, saves answers, and marks the attempt submitted', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      submittedAt: null,
      startedAt: new Date('2026-08-22T10:00:00Z'),
      quiz: quizWithQuestions,
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      { id: 'attempt-1', score: 0, submittedAt: null },
    ] as any)
    vi.mocked(prisma.attempt.update).mockResolvedValue({} as any)

    const result = await submitAttempt('attempt-1', 'user-1', [
      { questionId: 'q1', selectedOptionIds: ['a'] },
      { questionId: 'q2', selectedOptionIds: ['c'] },
    ])

    expect(result).toEqual({ ok: true, score: 10, maxScore: 30 })
    expect(prisma.attemptAnswer.createMany).toHaveBeenCalledWith({
      data: [
        { attemptId: 'attempt-1', questionId: 'q1', selectedOptionIds: ['a'], isCorrect: true, pointsAwarded: 10 },
        { attemptId: 'attempt-1', questionId: 'q2', selectedOptionIds: ['c'], isCorrect: false, pointsAwarded: 0 },
      ],
    })
    expect(prisma.attempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: expect.objectContaining({
        score: 10,
        submittedAt: expect.any(Date),
        completionSeconds: expect.any(Number),
        isLeaderboardEligible: true,
      }),
    })
  })

  it('scores a missing (unanswered) question as zero', async () => {
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-1',
      quizId: 'quiz-1',
      userId: 'user-1',
      submittedAt: null,
      startedAt: new Date(),
      quiz: quizWithQuestions,
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      { id: 'attempt-1', score: 0, submittedAt: null },
    ] as any)

    const result = await submitAttempt('attempt-1', 'user-1', [
      { questionId: 'q1', selectedOptionIds: ['a'] },
    ])

    expect(result).toEqual({ ok: true, score: 10, maxScore: 30 })
  })

  it('under UNLIMITED_BEST, marks only the highest-scoring attempt eligible', async () => {
    const bestQuiz = { ...quizWithQuestions, retakePolicy: 'UNLIMITED_BEST' }
    vi.mocked(prisma.attempt.findUnique).mockResolvedValue({
      id: 'attempt-2',
      quizId: 'quiz-1',
      userId: 'user-1',
      submittedAt: null,
      startedAt: new Date(),
      quiz: bestQuiz,
    } as any)
    vi.mocked(prisma.attempt.findMany).mockResolvedValue([
      { id: 'attempt-1', score: 5, submittedAt: new Date('2026-08-20T00:00:00Z') },
      { id: 'attempt-2', score: 0, submittedAt: null },
    ] as any)

    await submitAttempt('attempt-2', 'user-1', [
      { questionId: 'q1', selectedOptionIds: ['a'] },
      { questionId: 'q2', selectedOptionIds: ['c', 'd'] },
    ])

    expect(prisma.attempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-2' },
      data: expect.objectContaining({ isLeaderboardEligible: true }),
    })
    expect(prisma.attempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: { isLeaderboardEligible: false },
    })
  })
})
