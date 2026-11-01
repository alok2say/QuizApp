import type { AttemptResult } from '@/lib/quiz/queries'
import { Actions, Page, PageHeader, TextLink, VisuallyHidden } from '@/ui'
import { StartQuizButton } from '@/features/quizzes/StartQuizButton'
import sheet from './answerSheet.module.css'
import styles from './ResultView.module.css'

type Result = Extract<AttemptResult, { ok: true }>

export function ResultView({ result }: { result: Result }) {
  const canRetake = result.retakePolicy !== 'SINGLE_ATTEMPT'

  return (
    <Page>
      <PageHeader title={result.quizTitle} />
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

      <Actions spacing="loose">
        {canRetake && <StartQuizButton quizId={result.quizId} label="Retake quiz" />}
        <TextLink href={`/quizzes/${result.quizId}/leaderboard`}>See leaderboard</TextLink>
      </Actions>

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
                      <VisuallyHidden>
                        {[
                          option.wasSelected ? 'your answer' : '',
                          option.isCorrect ? 'correct answer' : '',
                        ].filter(Boolean).join(', ')}
                      </VisuallyHidden>
                    </li>
                  )
                })}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </Page>
  )
}
