import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getAttemptResult } from '@/lib/quiz/queries'
import { StartQuizButton } from '@/features/quizzes/StartQuizButton'
import sheet from '../../../answerSheet.module.css'
import styles from './result.module.css'

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

  const canRetake = result.retakePolicy !== 'SINGLE_ATTEMPT'

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>{result.quizTitle}</h1>
        <p className={styles.score}>
          {result.score}
          <span className={styles.outOf}> / {result.maxScore}</span>
        </p>

        <ol className={styles.summary} aria-label="Questions at a glance">
          {result.questions.map((question, index) => (
            <li key={question.id}>
              <a
                href={`#q-${index + 1}`}
                className={question.isCorrect ? styles.summaryRight : styles.summaryWrong}
                aria-label={`Question ${index + 1}: ${question.isCorrect ? 'correct' : 'incorrect'}`}
              >
                {question.isCorrect ? '●' : '✗'}
              </a>
            </li>
          ))}
        </ol>

        <div className={styles.actions}>
          {canRetake && (
            <StartQuizButton quizId={result.quizId} label="Retake quiz" />
          )}
          <Link className={styles.link} href={`/quizzes/${quizId}/leaderboard`}>See leaderboard</Link>
        </div>

        <ol className={`${sheet.questions} ${styles.questions}`}>
          {result.questions.map((question, index) => (
            <li key={question.id} id={`q-${index + 1}`} className={sheet.question}>
              <span className={sheet.number}>{index + 1}</span>
              <div>
                <div className={styles.questionHead}>
                  <h2 className={sheet.prompt}>{question.text}</h2>
                  <p className={styles.points}>
                    {question.pointsAwarded} / {question.points}
                  </p>
                </div>

                <ul className={sheet.options}>
                  {question.options.map((option, optionIndex) => {
                    const wrongPick = option.wasSelected && !option.isCorrect
                    const markClass = [
                      sheet.mark,
                      question.type === 'MULTI_SELECT' ? sheet.square : '',
                      option.wasSelected && option.isCorrect ? sheet.filled : '',
                      wrongPick ? sheet.wrong : '',
                      option.isCorrect ? sheet.correct : '',
                    ].join(' ')

                    return (
                      <li key={option.id} className={sheet.option}>
                        <span className={markClass} aria-hidden="true">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        {option.text}
                        {option.isCorrect && <span className={sheet.tick} aria-hidden="true">✓</span>}
                        {wrongPick && <span className={sheet.cross} aria-hidden="true">✗</span>}
                        <span className={sheet.srOnly}>
                          {[
                            option.wasSelected ? 'your answer' : '',
                            option.isCorrect ? 'correct answer' : '',
                          ].filter(Boolean).join(', ')}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
