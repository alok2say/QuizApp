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
