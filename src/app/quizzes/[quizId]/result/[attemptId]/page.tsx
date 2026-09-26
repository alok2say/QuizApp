import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getAttemptResult } from '@/lib/quiz/queries'

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

  return (
    <main>
      <h1>{result.quizTitle} — Result</h1>
      <p>
        Score: {result.score} / {result.maxScore}
      </p>

      {result.questions.map((question) => (
        <fieldset key={question.id}>
          <legend>
            {question.text} — {question.isCorrect ? 'Correct' : 'Incorrect'} (
            {question.pointsAwarded}/{question.points})
          </legend>
          <ul>
            {question.options.map((option) => (
              <li key={option.id}>
                {option.text}
                {option.wasSelected && ' (your answer)'}
                {option.isCorrect && ' (correct answer)'}
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
    </main>
  )
}
