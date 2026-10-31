import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getQuizzesWithStatus } from '@/lib/quiz/queries'
import { StartQuizButton } from './StartQuizButton'
import styles from './page.module.css'
import controls from './controls.module.css'

export default async function QuizzesPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const quizzes = await getQuizzesWithStatus(user.id)

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Quizzes</h1>
        <p className={styles.intro}>Pick one to start, or pick up where you left off.</p>

        {quizzes.length === 0 && (
          <p className={styles.empty}>No quizzes yet. Check back soon.</p>
        )}

        {quizzes.length > 0 && (
          <ul className={styles.list}>
            {quizzes.map((quiz) => {
              const attempt = quiz.latestAttempt
              const submitted = attempt && attempt.submittedAt !== null
              const canRetake = quiz.retakePolicy !== 'SINGLE_ATTEMPT'

              const bubbleClass = submitted ? styles.done : attempt ? styles.inProgress : ''
              const statusLabel = submitted ? 'Completed' : attempt ? 'In progress' : 'Not started'

              return (
                <li key={quiz.id} className={styles.row}>
                  <span
                    className={`${styles.bubble} ${bubbleClass}`}
                    role="img"
                    aria-label={statusLabel}
                  />

                  <div>
                    <h2 className={styles.quizTitle}>{quiz.title}</h2>
                    {quiz.description && <p className={styles.description}>{quiz.description}</p>}
                    <p className={styles.meta}>
                      {attempt && !submitted && <span>In progress</span>}
                      {attempt && submitted && <span>Scored {attempt.score}</span>}
                      <span>{Math.round(quiz.timeLimitSeconds / 60)} min</span>
                      <Link href={`/quizzes/${quiz.id}/leaderboard`}>Leaderboard</Link>
                    </p>
                  </div>

                  <div className={styles.action}>
                    {!attempt && (
                      <StartQuizButton quizId={quiz.id} label="Start quiz" className={controls.primary} />
                    )}

                    {attempt && !submitted && (
                      <StartQuizButton quizId={quiz.id} label="Resume quiz" className={controls.primary} />
                    )}

                    {attempt && submitted && (canRetake ? (
                      <StartQuizButton quizId={quiz.id} label="Retake quiz" className={controls.secondary} />
                    ) : (
                      <Link
                        className={controls.secondary}
                        href={`/quizzes/${quiz.id}/result/${attempt.id}`}
                      >
                        View result
                      </Link>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
