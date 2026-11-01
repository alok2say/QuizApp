import Link from 'next/link'
import { CircleCheck, CircleX } from 'lucide-react'
import type { AttemptResult } from '@/lib/quiz/queries'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Page, PageHeader } from '@/ui'
import { StartQuizButton } from '@/features/quizzes/StartQuizButton'

type Result = Extract<AttemptResult, { ok: true }>

export function ResultView({ result }: { result: Result }) {
  const canRetake = result.retakePolicy !== 'SINGLE_ATTEMPT'

  return (
    <Page>
      <PageHeader title={result.quizTitle} />

      <Card>
        <CardHeader>
          <p className="text-6xl font-bold tracking-tight tabular-nums">
            {result.score}
            <span className="font-medium text-muted-foreground"> / {result.maxScore}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <ol className="flex flex-wrap gap-2" aria-label="Questions at a glance">
            {result.questions.map((question, index) => (
              <li key={question.id}>
                <a
                  href={`#q-${index + 1}`}
                  aria-label={`Question ${index + 1}: ${question.isCorrect ? 'correct' : 'incorrect'}`}
                  className={cn(
                    buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
                    question.isCorrect ? 'text-success' : 'text-destructive',
                  )}
                >
                  {question.isCorrect ? <CircleCheck /> : <CircleX />}
                </a>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            {canRetake && <StartQuizButton quizId={result.quizId} label="Retake quiz" />}
            <Link href={`/quizzes/${result.quizId}/leaderboard`} className={buttonVariants({ variant: 'outline' })}>
              See leaderboard
            </Link>
          </div>
        </CardContent>
      </Card>

      <ol className="mt-8 space-y-4">
        {result.questions.map((question, index) => (
          <li key={question.id} id={`q-${index + 1}`} className="scroll-mt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>
                    {index + 1}. {question.text}
                  </h2>
                </CardTitle>
                <CardAction>
                  <Badge variant="outline" className="tabular-nums">
                    {question.pointsAwarded} / {question.points}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const wrongPick = option.wasSelected && !option.isCorrect
                    return (
                      <li
                        key={option.id}
                        className={cn(
                          'flex flex-wrap items-center gap-3 rounded-md border px-3 py-2',
                          option.isCorrect && 'border-success',
                          wrongPick && 'border-destructive',
                        )}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold" aria-hidden="true">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span className="flex-1">{option.text}</span>
                        {option.isCorrect && (
                          <Badge className="bg-success text-success-foreground">Correct answer</Badge>
                        )}
                        {option.wasSelected && (
                          <Badge variant={wrongPick ? 'destructive' : 'secondary'}>Your answer</Badge>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </Page>
  )
}
