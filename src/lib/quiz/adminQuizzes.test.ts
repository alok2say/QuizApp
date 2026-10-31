import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    quiz: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    question: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  }
  prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
  return { prisma: prismaMock }
})

import { prisma } from '@/lib/prisma'
import { createQuizFromJson, replaceQuizFromJson, deleteQuizById } from './adminQuizzes'

const quizInput = {
  title: 'Capitals Quiz',
  description: 'Test your knowledge',
  timeLimitSeconds: 300,
  retakePolicy: 'UNLIMITED_BEST' as const,
  feedbackMode: 'END_ONLY' as const,
  leaderboardSize: 10,
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
    vi.mocked(prisma.quiz.create).mockResolvedValue({ id: 'quiz-1' } as never)

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
        leaderboardSize: 10,
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
    vi.mocked(prisma.quiz.create).mockResolvedValue({ id: 'quiz-1' } as never)

    await createQuizFromJson({ ...quizInput, description: undefined })

    expect(prisma.quiz.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ description: null }) }),
    )
  })
})

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
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({ id: 'quiz-1' } as never)

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
        leaderboardSize: 10,
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
    vi.mocked(prisma.quiz.findUnique).mockResolvedValue({ id: 'quiz-1' } as never)

    const result = await deleteQuizById('quiz-1')

    expect(result).toEqual({ ok: true })
    expect(prisma.quiz.delete).toHaveBeenCalledWith({ where: { id: 'quiz-1' } })
  })
})
