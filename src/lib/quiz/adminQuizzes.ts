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
