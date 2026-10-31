import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getAttemptResult } from '@/lib/quiz/queries'
import { ResultView } from '@/features/attempt/ResultView'

export default async function ResultPage({
  params,
}: {
  params: Promise<{ quizId: string; attemptId: string }>
}) {
  const { quizId, attemptId } = await params

  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const result = await getAttemptResult(attemptId, user.id)

  if (!result.ok) {
    if (result.status === 404) notFound()
    if (result.status === 409) redirect(`/quizzes/${quizId}/take/${attemptId}`)
    notFound()
  }

  return <ResultView result={result} />
}
