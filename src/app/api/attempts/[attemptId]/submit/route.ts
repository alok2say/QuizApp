import { z } from 'zod'
import { getCurrentUser } from '@/lib/session'
import { submitAttempt } from '@/lib/quiz/attempts'

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      selectedOptionIds: z.array(z.string()),
    }),
  ),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const json = await request.json()
  const parsed = submitSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid submission body.' }, { status: 400 })
  }

  const { attemptId } = await params
  const result = await submitAttempt(attemptId, user.id, parsed.data.answers)

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  return Response.json({ score: result.score, maxScore: result.maxScore }, { status: 200 })
}
