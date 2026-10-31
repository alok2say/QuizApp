import { prisma } from "@/lib/prisma";
export type QuizListItem = {
    id: string
    title: string
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
    type: 'SINGLE_SELECT' | 'MULTI_SELECT'
    isCorrect: boolean
    pointsAwarded: number
    points: number
    options: { id: string; text: string; isCorrect: boolean; wasSelected: boolean }[]
}

export type AttemptResult =
    | {
        ok: true
        quizId: string
        quizTitle: string
        retakePolicy: 'UNLIMITED_BEST' | 'UNLIMITED_LATEST' | 'SINGLE_ATTEMPT'
        score: number
        maxScore: number
        questions: AnsweredQuestion[]
    }
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

    const sortedQuestions = [...attempt.quiz.questions].sort((a, b) => a.order - b.order)

    const questions = sortedQuestions.map((question) => {
        const answer = answersByQuestion.get(question.id)
        const selected = new Set(answer?.selectedOptionIds ?? [])

        return {
            id: question.id,
            text: question.text,
            type: question.type,
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
        quizId: attempt.quiz.id,
        quizTitle: attempt.quiz.title,
        retakePolicy: attempt.quiz.retakePolicy,
        score: attempt.score,
        maxScore,
        questions,
    }
}

export type AdminQuizListItem = { id: string; title: string; questionCount: number; createdAt: Date }

export async function getAllQuizzesForAdmin(): Promise<AdminQuizListItem[]> {
    const quizzes = await prisma.quiz.findMany({
        include: { _count: { select: { questions: true } } },
        orderBy: { createdAt: 'desc' },
    })

    return quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        questionCount: quiz._count.questions,
        createdAt: quiz.createdAt,
    }))
}

export type QuizJsonData = {
    title: string
    description?: string
    timeLimitSeconds: number
    retakePolicy: 'UNLIMITED_BEST' | 'UNLIMITED_LATEST' | 'SINGLE_ATTEMPT'
    feedbackMode: 'END_ONLY' | 'IMMEDIATE'
    leaderboardSize: number
    questions: {
        text: string
        type: 'SINGLE_SELECT' | 'MULTI_SELECT'
        points: number
        options: { text: string; isCorrect: boolean }[]
    }[]
}

export async function getQuizAsJson(quizId: string): Promise<QuizJsonData | null> {
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: { questions: { include: { options: true }, orderBy: { order: 'asc' } } },
    })

    if (!quiz) {
        return null
    }

    return {
        title: quiz.title,
        description: quiz.description ?? undefined,
        timeLimitSeconds: quiz.timeLimitSeconds,
        retakePolicy: quiz.retakePolicy,
        feedbackMode: quiz.feedbackMode,
        leaderboardSize: quiz.leaderboardSize,
        // sort explicitly — Prisma's own orderBy only applies against a real DB, not this fn's tests
        questions: [...quiz.questions]
            .sort((a, b) => a.order - b.order)
            .map((question) => ({
                text: question.text,
                type: question.type,
                points: question.points,
                // order and IDs deliberately dropped — matches the admin JSON's "pure content" shape
                options: question.options.map((option) => ({
                    text: option.text,
                    isCorrect: option.isCorrect,
                })),
            })),
    }
}

export type LeaderboardEntry = {
    userId: string
    displayName: string
    score: number
    completionSeconds: number | null
}

export type LeaderboardResult =
    | {
        ok: true
        quizTitle: string
        maxScore: number
        top: LeaderboardEntry[]
        ownRank: LeaderboardEntry | null
        hasAttempted: boolean
    }
    | { ok: false; status: 404; error: string }

export async function getLeaderboard(quizId: string, userId: string): Promise<LeaderboardResult> {
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: { questions: true },
    })

    if (!quiz) {
        return { ok: false, status: 404, error: 'Quiz not found.' }
    }

    const attempts = await prisma.attempt.findMany({
        where: { quizId, isLeaderboardEligible: true },
        include: { user: true },
    })

    // score desc, then completionSeconds asc (fastest wins), then submittedAt asc (earliest wins)
    const ranked = [...attempts].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        const aTime = a.completionSeconds ?? Infinity
        const bTime = b.completionSeconds ?? Infinity
        if (aTime !== bTime) return aTime - bTime
        return a.submittedAt!.getTime() - b.submittedAt!.getTime()
    })

    const entries: LeaderboardEntry[] = ranked.map((attempt) => ({
        userId: attempt.userId,
        displayName: attempt.user.name ?? attempt.user.email.split('@')[0],
        score: attempt.score,
        completionSeconds: attempt.completionSeconds,
    }))

    const top = entries.slice(0, quiz.leaderboardSize)
    const maxScore = quiz.questions.reduce((sum, q) => sum + q.points, 0)

    const ownEntry = entries.find((entry) => entry.userId === userId)
    const isInTop = top.some((entry) => entry.userId === userId)

    return {
        ok: true,
        quizTitle: quiz.title,
        maxScore,
        top,
        // null covers two cases the caller must tell apart via hasAttempted:
        // already visible in top, or never attempted at all
        ownRank: ownEntry && !isInTop ? ownEntry : null,
        hasAttempted: ownEntry !== undefined,
    }
}