import { prisma } from '@/lib/prisma'
import { scoreAnswer } from './scoring'

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

export type SubmitAnswerInput = { questionId: string; selectedOptionIds: string[] }

export type SubmitAttemptResult =
  | { ok: true; score: number; maxScore: number }
  | { ok: false; status: 403 | 404 | 409; error: string }

export async function submitAttempt(
  attemptId: string,
  userId: string,
  answers: SubmitAnswerInput[],
): Promise<SubmitAttemptResult> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { quiz: { include: { questions: { include: { options: true } } } } },
  })

  if (!attempt) {
    return { ok: false, status: 404, error: 'Attempt not found.' }
  }
  if (attempt.userId !== userId) {
    return { ok: false, status: 403, error: 'Forbidden.' }
  }
  if (attempt.submittedAt !== null) {
    return { ok: false, status: 409, error: 'Attempt already submitted.' }
  }

  const answersByQuestion = new Map(answers.map((a) => [a.questionId, a.selectedOptionIds]))

  const scored = attempt.quiz.questions.map((question) =>
    scoreAnswer(question, answersByQuestion.get(question.id) ?? []),
  )

  const score = scored.reduce((sum, s) => sum + s.pointsAwarded, 0)
  const maxScore = attempt.quiz.questions.reduce((sum, q) => sum + q.points, 0)
  const submittedAt = new Date()
  const completionSeconds = Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)

  await prisma.attemptAnswer.createMany({
    data: scored.map((s) => ({
      attemptId,
      questionId: s.questionId,
      selectedOptionIds: answersByQuestion.get(s.questionId) ?? [],
      isCorrect: s.isCorrect,
      pointsAwarded: s.pointsAwarded,
    })),
  })

  const siblings = await prisma.attempt.findMany({
    where: { quizId: attempt.quizId, userId },
  })

  const isCurrentEligible = await resolveLeaderboardEligibility(
    attempt.quiz.retakePolicy,
    siblings.map((a) => ({
      id: a.id,
      score: a.id === attemptId ? score : a.score,
      submittedAt: a.id === attemptId ? submittedAt : a.submittedAt,
    })),
    attemptId,
  )

  await prisma.attempt.update({
    where: { id: attemptId },
    data: { score, submittedAt, completionSeconds, isLeaderboardEligible: isCurrentEligible },
  })

  return { ok: true, score, maxScore }
}

async function resolveLeaderboardEligibility(
  retakePolicy: string,
  attempts: { id: string; score: number; submittedAt: Date | null }[],
  currentAttemptId: string,
): Promise<boolean> {
  let eligibleId: string

  if (retakePolicy === 'UNLIMITED_BEST') {
    eligibleId = attempts.reduce((best, a) => {
      if (a.score > best.score) return a
      if (a.score === best.score && (a.submittedAt?.getTime() ?? Infinity) < (best.submittedAt?.getTime() ?? Infinity)) return a
      return best
    }).id
  } else {
    eligibleId = currentAttemptId
  }

  for (const a of attempts) {
    if (a.id === currentAttemptId) continue
    await prisma.attempt.update({
      where: { id: a.id },
      data: { isLeaderboardEligible: a.id === eligibleId },
    })
  }

  return eligibleId === currentAttemptId
}
