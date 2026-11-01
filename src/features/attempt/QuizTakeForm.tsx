'use client'

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TakeableQuestion } from '@/lib/quiz/queries'
import { formatDuration } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { answeredCount, bubbleLabel, clampIndex, parseCachedIndex } from './questionNav'

// Shared widths so the sticky bar, the question and the footer line up
const COLUMN = 'mx-auto w-full max-w-3xl px-4'

type Props = {
  quizId: string
  attemptId: string
  quizTitle: string
  questions: TakeableQuestion[]
  remainingSeconds: number
}

type AnswersMap = Record<string, string[]>

function storageKey(attemptId: string) {
  return `quiz-attempt-${attemptId}`
}

// Which question was on screen, so a reload comes back to it
function currentKey(attemptId: string) {
  return `quiz-attempt-${attemptId}-current`
}

function readCachedAnswers(attemptId: string): AnswersMap {
  try {
    const cached = localStorage.getItem(storageKey(attemptId))
    return cached ? JSON.parse(cached) : {}
  } catch {
    return {}
  }
}

function readCachedIndex(attemptId: string, total: number): number {
  try {
    return parseCachedIndex(localStorage.getItem(currentKey(attemptId)), total)
  } catch {
    return 0
  }
}

const subscribeNever = () => () => {}

// Cached answers live in localStorage, which the server can't read. Render a
// shell until hydrated so server and client HTML match, then mount the form.
export function QuizTakeForm(props: Props) {
  const hydrated = useSyncExternalStore(subscribeNever, () => true, () => false)

  if (!hydrated) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="sticky top-0 z-10 border-b bg-background">
          <div className={cn(COLUMN, 'py-4')}>
            <h1 className="text-xl font-semibold tracking-tight">{props.quizTitle}</h1>
          </div>
        </div>
        <main className={cn(COLUMN, 'flex-1 py-8')}>
          <p className="text-muted-foreground">Loading your answers…</p>
        </main>
      </div>
    )
  }

  return <AttemptForm {...props} />
}

function AttemptForm({ quizId, attemptId, quizTitle, questions, remainingSeconds }: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState<AnswersMap>(() => readCachedAnswers(attemptId))
  const [current, setCurrent] = useState(() => readCachedIndex(attemptId, questions.length))
  const [deadline] = useState(() => Date.now() + remainingSeconds * 1000)
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds)
  const [submitting, setSubmitting] = useState(false)
  const answersRef = useRef(answers)
  const submittedRef = useRef(false)
  const promptRef = useRef<HTMLLegendElement>(null)
  const navigatedRef = useRef(false)

  async function submit() {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)

    const payload = {
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedOptionIds: answersRef.current[q.id] ?? [],
      })),
    }

    const res = await fetch(`/api/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      localStorage.removeItem(storageKey(attemptId))
      localStorage.removeItem(currentKey(attemptId))
      router.push(`/quizzes/${quizId}/result/${attemptId}`)
    } else {
      setSubmitting(false)
      submittedRef.current = false
    }
  }

  const onTimeUp = useEffectEvent(() => {
    submit()
  })

  // Derive time left from a fixed deadline so the clock can't drift or be
  // reset by re-renders.
  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(Math.ceil((deadline - Date.now()) / 1000), 0)
      setSecondsLeft(left)
      if (left === 0) {
        clearInterval(timer)
        onTimeUp()
      }
    }, 250)
    return () => clearInterval(timer)
  }, [deadline])

  // After moving to another question, put focus on its prompt so screen
  // readers announce it. Skipped on first render: focus stays where it is.
  useEffect(() => {
    if (!navigatedRef.current) return
    promptRef.current?.focus({ preventScroll: true })
  }, [current])

  function goTo(index: number) {
    const next = clampIndex(index, questions.length)
    navigatedRef.current = true
    setCurrent(next)
    localStorage.setItem(currentKey(attemptId), String(next))
    window.scrollTo({ top: 0 })
  }

  function toggleOption(question: TakeableQuestion, optionId: string) {
    const picked = answers[question.id] ?? []
    const selected =
      question.type === 'SINGLE_SELECT'
        ? [optionId]
        : picked.includes(optionId)
          ? picked.filter((id) => id !== optionId)
          : [...picked, optionId]
    const next = { ...answers, [question.id]: selected }

    setAnswers(next)
    answersRef.current = next
    localStorage.setItem(storageKey(attemptId), JSON.stringify(next))
  }

  const total = questions.length
  const answered = answeredCount(questions, answers)
  const unanswered = total - answered
  const isLast = current >= total - 1
  const question = questions[current]
  const multi = question?.type === 'MULTI_SELECT'

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b bg-background">
        <div className={cn(COLUMN, 'space-y-3 py-4')}>
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight">{quizTitle}</h1>
            <Badge
              variant={secondsLeft < 60 ? 'destructive' : 'outline'}
              className="h-7 px-3 text-base tabular-nums"
              aria-label={`Time left ${formatDuration(secondsLeft)}`}
            >
              {formatDuration(secondsLeft)}
            </Badge>
          </div>

          <Progress value={total === 0 ? 0 : (answered / total) * 100} aria-label="Answered" />

          <div className="flex items-center gap-4">
            <ol className="-m-1 flex min-w-0 flex-1 gap-2 overflow-x-auto p-1" aria-label="Questions">
              {questions.map((q, index) => {
                const isAnswered = (answers[q.id] ?? []).length > 0
                return (
                  <li key={q.id}>
                    <Button
                      variant={isAnswered ? 'default' : 'outline'}
                      size="icon-sm"
                      className="rounded-full tabular-nums aria-[current=step]:ring-2 aria-[current=step]:ring-ring aria-[current=step]:ring-offset-2 aria-[current=step]:ring-offset-background"
                      aria-label={bubbleLabel(index, isAnswered)}
                      aria-current={index === current ? 'step' : undefined}
                      onClick={() => goTo(index)}
                    >
                      {index + 1}
                    </Button>
                  </li>
                )
              })}
            </ol>
            <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
              Question {current + 1} of {total}
            </p>
          </div>
        </div>
      </div>

      <main className={cn(COLUMN, 'flex-1 py-8')}>
        {question && (
          <Card key={question.id}>
            <CardHeader>
              <p className="text-4xl font-bold tracking-tight text-muted-foreground tabular-nums" aria-hidden="true">
                {current + 1}
              </p>
            </CardHeader>
            <CardContent>
              <fieldset className="min-w-0">
                <legend
                  ref={promptRef}
                  tabIndex={-1}
                  className="text-2xl font-semibold tracking-tight outline-none"
                >
                  {question.text}
                </legend>
                {multi && <p className="mt-1 text-sm text-muted-foreground">Pick all that apply</p>}

                {multi ? (
                  <div className="mt-6 grid gap-2">
                    {question.options.map((option, optionIndex) => {
                      const checked = (answers[question.id] ?? []).includes(option.id)
                      return (
                        <label key={option.id} className={optionRow(checked)}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleOption(question, option.id)} />
                          <OptionText letter={optionIndex} text={option.text} />
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <RadioGroup
                    className="mt-6"
                    value={(answers[question.id] ?? [])[0] ?? null}
                    onValueChange={(value) => toggleOption(question, String(value))}
                  >
                    {question.options.map((option, optionIndex) => (
                      <label
                        key={option.id}
                        className={optionRow((answers[question.id] ?? []).includes(option.id))}
                      >
                        <RadioGroupItem value={option.id} />
                        <OptionText letter={optionIndex} text={option.text} />
                      </label>
                    ))}
                  </RadioGroup>
                )}
              </fieldset>
            </CardContent>
          </Card>
        )}
      </main>

      <div className="sticky bottom-0 z-10 border-t bg-background">
        <div className={cn(COLUMN, 'grid grid-cols-2 items-center gap-3 py-4 sm:grid-cols-3')}>
          <p className="col-span-2 text-center text-sm text-muted-foreground tabular-nums sm:order-2 sm:col-span-1">
            {isLast && unanswered > 0
              ? `${unanswered} ${unanswered === 1 ? 'question' : 'questions'} unanswered`
              : `${answered} of ${total} answered`}
          </p>
          <div className="justify-self-start sm:order-1">
            {current > 0 && (
              <Button variant="outline" size="lg" onClick={() => goTo(current - 1)}>
                <ChevronLeft />
                Previous
              </Button>
            )}
          </div>
          <div className="justify-self-end sm:order-3">
            {isLast ? (
              <Button size="lg" onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit answers'}
              </Button>
            ) : (
              <Button size="lg" onClick={() => goTo(current + 1)}>
                Next
                <ChevronRight />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function optionRow(selected: boolean) {
  return cn(
    'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50',
    selected && 'border-primary bg-muted/50',
  )
}

function OptionText({ letter, text }: { letter: number; text: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="text-sm font-semibold text-muted-foreground" aria-hidden="true">
        {String.fromCharCode(65 + letter)}
      </span>
      <span>{text}</span>
    </span>
  )
}
