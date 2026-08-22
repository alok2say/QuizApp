import { getCurrentUser } from '@/lib/session'
import { startAttempt } from '@/lib/quiz/attempts'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { quizId } = await params
  const result = await startAttempt(quizId, user.id)

  if (!result.ok) {
    return Response.json(
      { error: result.error, attemptId: result.attemptId, resume: result.resume },
      { status: result.status },
    )
  }

  return Response.json({ attemptId: result.attemptId }, { status: 200 })
}
