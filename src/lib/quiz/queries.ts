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