import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    quiz: { findUnique: vi.fn() },
    attempt: { findMany: vi.fn(), create: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { startAttempt } from './attempts'

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
