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
      leaderboardSize: data.leaderboardSize ?? 10,
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

  // Full replace: delete all old questions (options cascade with them),
  // update the quiz's own fields, then recreate questions fresh — all in
  // one transaction so a mid-way failure doesn't leave a half-replaced quiz.
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
        leaderboardSize: data.leaderboardSize ?? 10,
      },
    })

    for (const [index, question] of data.questions.entries()) {
      await tx.question.create({
        data: {
          quizId,
          text: question.text,
          order: index + 1, // order is array position, never sent in the JSON
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

export type DeleteQuizResult = {ok: true} | {ok: false; status: 404; error: string} 

export async function deleteQuizById(quizId: string): Promise<DeleteQuizResult> {
  const existing = await prisma.quiz.findUnique({where: {id: quizId}})
  if (!existing){
    return {ok: false, status: 404, error: 'Quiz not found.'}
  }
  await prisma.quiz.delete({where: {id: quizId}})
  return {ok: true}
}
