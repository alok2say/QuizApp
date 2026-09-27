import { getCurrentUser } from '@/lib/session'
import { validateQuizJson } from '@/lib/quiz/quizJsonSchema'
import { replaceQuizFromJson, deleteQuizById } from '@/lib/quiz/adminQuizzes'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if (user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden.' }, { status: 403 })
  }

  // Parse-then-validate: a broken body and a well-formed-but-invalid
  // body are different failures, both returned as 400.
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  const validated = validateQuizJson(json)
  if (!validated.ok) {
    return Response.json({ errors: validated.errors }, { status: 400 })
  }

  const { quizId } = await params
  const result = await replaceQuizFromJson(quizId, validated.data)

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  return Response.json({ ok: true }, { status: 200 })
}

export async function DELETE(
  // unused, but required by Next.js's route-handler signature
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated.' }, { status: 401 })
  }
  if (user.role !== 'ADMIN') {
    return Response.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { quizId } = await params
  const result = await deleteQuizById(quizId)

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status })
  }

  // 204: deleted, no body to send back
  return new Response(null, { status: 204 })
}
