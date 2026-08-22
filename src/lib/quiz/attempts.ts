import { prisma } from '@/lib/prisma'

export type StartAttemptResult =
  | { ok: true; attemptId: string }
  | { ok: false; status: 404 | 409; error: string; attemptId?: string; resume?: boolean }

export async function startAttempt(quizId: string, userId: string): Promise<StartAttemptResult> {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } })
  if (!quiz) {
    return { ok: false, status: 404, error: 'Quiz not found.' }
  }

  if (quiz.retakePolicy === 'SINGLE_ATTEMPT') {
    const existing = await prisma.attempt.findMany({ where: { quizId, userId } })
    if (existing.length > 0) {
      const attempt = existing[0]
      return {
        ok: false,
        status: 409,
        error: 'You have already attempted this quiz.',
        attemptId: attempt.id,
        resume: attempt.submittedAt === null,
      }
    }
  }

  const attempt = await prisma.attempt.create({ data: { quizId, userId } })
  return { ok: true, attemptId: attempt.id }
}
