import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { quiz: { findMany: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { getQuizzesWithStatus } from './queries'

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
