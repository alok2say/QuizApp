import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getQuizzesWithStatus } from '@/lib/quiz/queries'
import { StartQuizButton } from './StartQuizButton'

export default async function QuizzesPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const quizzes = await getQuizzesWithStatus(user.id)

  return (
    <main>
      <h1>Quizzes</h1>
      <ul>
        {quizzes.map((quiz) => {
          const attempt = quiz.latestAttempt
          const submitted = attempt && attempt.submittedAt !== null
          const canRetake = quiz.retakePolicy !== 'SINGLE_ATTEMPT'

          return (
            <li key={quiz.id}>
              <h2>{quiz.title}</h2>
              {quiz.description && <p>{quiz.description}</p>}
              <p>Time limit: {Math.round(quiz.timeLimitSeconds / 60)} min</p>

              {!attempt && <StartQuizButton quizId={quiz.id} label="Start Quiz" />}

              {attempt && !submitted && <StartQuizButton quizId={quiz.id} label="Resume Quiz" />}

              {attempt && submitted && (
                <>
                  <p>Your score: {attempt.score}</p>
                  {canRetake ? (
                    <StartQuizButton quizId={quiz.id} label="Retake Quiz" />
                  ) : (
                    <a href={`/quizzes/${quiz.id}/result/${attempt.id}`}>View Result</a>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
