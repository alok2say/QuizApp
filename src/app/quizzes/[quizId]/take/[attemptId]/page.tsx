import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getQuizForTaking } from '@/lib/quiz/queries'
import { QuizTakeForm } from '@/features/attempt/QuizTakeForm'

export default async function TakeQuizPage({
  params,
}: {
  params: Promise<{ quizId: string; attemptId: string }>
}) {
  const { quizId, attemptId } = await params

  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const result = await getQuizForTaking(quizId, attemptId, user.id)

  if (!result.ok) {
    if (result.status === 404) notFound()
    redirect(`/quizzes/${quizId}/result/${attemptId}`)
  }

  const elapsedSeconds = Math.floor((Date.now() - result.startedAt.getTime()) / 1000)
  const remainingSeconds = Math.max(result.timeLimitSeconds - elapsedSeconds, 0)

  return (
    <QuizTakeForm
      quizId={quizId}
      attemptId={attemptId}
      quizTitle={result.quizTitle}
      questions={result.questions}
      remainingSeconds={remainingSeconds}
    />
  )
}
