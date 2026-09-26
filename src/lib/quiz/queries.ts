import { prisma } from "@/lib/prisma";
export type QuizListItem = {
    id: string
    title: String
    description: string | null
    timeLimitSeconds: number
    retakePolicy: 'UNLIMITED_BEST' | 'UNLIMITED_LATEST' | 'SINGLE_ATTEMPT'
    latestAttempt: { id: string; score: number; submittedAt: Date | null } | null
}

export async function getQuizzesWithStatus(userId: string): Promise<QuizListItem[]> {
    const quizzes = await prisma.quiz.findMany({
        include: {
            attempts: {
                where: { userId },
                orderBy: { startedAt: 'desc' },
                take: 1,
            },
        },
    })

    return quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        timeLimitSeconds: quiz.timeLimitSeconds,
        retakePolicy: quiz.retakePolicy,
        latestAttempt: quiz.attempts[0]
            ? {
                id: quiz.attempts[0].id,
                score: quiz.attempts[0].score,
                submittedAt: quiz.attempts[0].submittedAt,
            }
            : null,
    })

    )
}

export type TakeableQuestion = {
    id: string
    text: string
    order: number
    type: 'SINGLE_SELECT' | 'MULTI_SELECT'
    options: { id: string; text: string }[]
}

export type QuizForTaking =
    | { ok: true; quizTitle: string; timeLimitSeconds: number; startedAt: Date; questions: TakeableQuestion[] }
    | { ok: false; status: 403 | 404 | 409; error: string }

export async function getQuizForTaking(
    quizId: string,
    attemptId: string,
    userId: string,
): Promise<QuizForTaking> {
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
        return { ok: false, status: 409, error: 'This attempt was already submitted.' }
    }

    const questions = [...attempt.quiz.questions]
        .sort((a, b) => a.order - b.order)
        .map((q) => ({
            id: q.id,
            text: q.text,
            order: q.order,
            type: q.type,
            options: q.options.map((o) => ({ id: o.id, text: o.text })),
        }))

    return {
        ok: true,
        quizTitle: attempt.quiz.title,
        timeLimitSeconds: attempt.quiz.timeLimitSeconds,
        startedAt: attempt.startedAt,
        questions,
    }
}

export type AnsweredQuestion = {
    id: string
    text: string
    isCorrect: boolean
    pointsAwarded: number
    points: number
    options: { id: string; text: string; isCorrect: boolean; wasSelected: boolean }[]
}

export type AttemptResult =
    | { ok: true; quizTitle: string; score: number; maxScore: number; questions: AnsweredQuestion[] }
    | { ok: false; status: 403 | 404 | 409; error: string }

export async function getAttemptResult(attemptId: string, userId: string): Promise<AttemptResult> {
    const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
            quiz: { include: { questions: { include: { options: true } } } },
            answers: true,
        },
    })

    if (!attempt) {
        return { ok: false, status: 404, error: 'Attempt not found.' }
    }
    if (attempt.userId !== userId) {
        return { ok: false, status: 403, error: 'Forbidden.' }
    }
    if (attempt.submittedAt === null) {
        return { ok: false, status: 409, error: 'This attempt has not been submitted yet.' }
    }

    const answersByQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]))
    const maxScore = attempt.quiz.questions.reduce((sum, q) => sum + q.points, 0)

    const questions = attempt.quiz.questions.map((question) => {
        const answer = answersByQuestion.get(question.id)
        const selected = new Set(answer?.selectedOptionIds ?? [])

        return {
            id: question.id,
            text: question.text,
            isCorrect: answer?.isCorrect ?? false,
            pointsAwarded: answer?.pointsAwarded ?? 0,
            points: question.points,
            options: question.options.map((o) => ({
                id: o.id,
                text: o.text,
                isCorrect: o.isCorrect,
                wasSelected: selected.has(o.id),
            })),
        }
    })

    return {
        ok: true,
        quizTitle: attempt.quiz.title,
        score: attempt.score,
        maxScore,
        questions,
    }
}