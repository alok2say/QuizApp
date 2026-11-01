import Link from 'next/link'
import type { QuizListItem } from '@/lib/quiz/queries'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, Page, PageHeader } from '@/ui'
import { StartQuizButton } from './StartQuizButton'

export function QuizListView({ quizzes }: { quizzes: QuizListItem[] }) {
  return (
    <Page>
      <PageHeader title="Quizzes" description="Pick one to start, or pick up where you left off." />

      {quizzes.length === 0 && <EmptyState>No quizzes yet. Check back soon.</EmptyState>}

      {quizzes.length > 0 && (
        <ul className="grid gap-4">
          {quizzes.map((quiz) => (
            <li key={quiz.id}>
              <QuizCard quiz={quiz} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

const STATUS = {
  notStarted: { label: 'Not started', variant: 'outline' },
  inProgress: { label: 'In progress', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'default' },
} as const

function QuizCard({ quiz }: { quiz: QuizListItem }) {
  const attempt = quiz.latestAttempt
  const submitted = attempt && attempt.submittedAt !== null
  const canRetake = quiz.retakePolicy !== 'SINGLE_ATTEMPT'
  const status = STATUS[submitted ? 'completed' : attempt ? 'inProgress' : 'notStarted']

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{quiz.title}</h2>
        </CardTitle>
        {quiz.description && <CardDescription>{quiz.description}</CardDescription>}
        <CardAction>
          <Badge variant={status.variant}>{status.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-wrap justify-between gap-4">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
          {attempt && submitted && <span>Scored {attempt.score}</span>}
          <span>{Math.round(quiz.timeLimitSeconds / 60)} min</span>
          <Link href={`/quizzes/${quiz.id}/leaderboard`} className="text-foreground underline underline-offset-4">
            Leaderboard
          </Link>
        </p>
        <div>
          {!attempt && <StartQuizButton quizId={quiz.id} label="Start quiz" />}

          {attempt && !submitted && <StartQuizButton quizId={quiz.id} label="Resume quiz" />}

          {attempt && submitted && (canRetake ? (
            <StartQuizButton quizId={quiz.id} label="Retake quiz" variant="outline" />
          ) : (
            <Link href={`/quizzes/${quiz.id}/result/${attempt.id}`} className={buttonVariants({ variant: 'outline' })}>
              View result
            </Link>
          ))}
        </div>
      </CardFooter>
    </Card>
  )
}
