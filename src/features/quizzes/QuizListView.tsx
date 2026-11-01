import Link from 'next/link'
import type { QuizListItem } from '@/lib/quiz/queries'
import { ButtonLink, Description, EmptyState, Heading, List, ListRow, Meta, Page, PageHeader } from '@/ui'
import { StartQuizButton } from './StartQuizButton'
import styles from './QuizRow.module.css'

export function QuizListView({ quizzes }: { quizzes: QuizListItem[] }) {
  return (
    <Page>
      <PageHeader title="Quizzes" description="Pick one to start, or pick up where you left off." />

      {quizzes.length === 0 && <EmptyState>No quizzes yet. Check back soon.</EmptyState>}

      {quizzes.length > 0 && (
        <List>
          {quizzes.map((quiz) => (
            <QuizRow key={quiz.id} quiz={quiz} />
          ))}
        </List>
      )}
    </Page>
  )
}

function QuizRow({ quiz }: { quiz: QuizListItem }) {
  const attempt = quiz.latestAttempt
  const submitted = attempt && attempt.submittedAt !== null
  const canRetake = quiz.retakePolicy !== 'SINGLE_ATTEMPT'

  const bubbleClass = submitted ? styles.done : attempt ? styles.inProgress : ''
  const statusLabel = submitted ? 'Completed' : attempt ? 'In progress' : 'Not started'

  return (
    <ListRow className={styles.row}>
      <span className={`${styles.bubble} ${bubbleClass}`} role="img" aria-label={statusLabel} />

      <div>
        <Heading>{quiz.title}</Heading>
        {quiz.description && <Description>{quiz.description}</Description>}
        <Meta>
          {attempt && !submitted && <span>In progress</span>}
          {attempt && submitted && <span>Scored {attempt.score}</span>}
          <span>{Math.round(quiz.timeLimitSeconds / 60)} min</span>
          <Link href={`/quizzes/${quiz.id}/leaderboard`}>Leaderboard</Link>
        </Meta>
      </div>

      <div className={styles.action}>
        {!attempt && <StartQuizButton quizId={quiz.id} label="Start quiz" />}

        {attempt && !submitted && <StartQuizButton quizId={quiz.id} label="Resume quiz" />}

        {attempt && submitted && (canRetake ? (
          <StartQuizButton quizId={quiz.id} label="Retake quiz" variant="secondary" />
        ) : (
          <ButtonLink variant="secondary" href={`/quizzes/${quiz.id}/result/${attempt.id}`}>
            View result
          </ButtonLink>
        ))}
      </div>
    </ListRow>
  )
}
