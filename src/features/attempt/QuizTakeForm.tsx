'use client'

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { TakeableQuestion } from '@/lib/quiz/queries'
import { formatDuration } from '@/lib/format'
import { Button } from '@/ui'
import { answeredCount, bubbleLabel, clampIndex, parseCachedIndex } from './questionNav'
import sheet from './answerSheet.module.css'
import styles from './TakeView.module.css'

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
      <div className={styles.page}>
        <div className={styles.bar}>
          <div className={styles.barTop}>
            <h1 className={styles.title}>{props.quizTitle}</h1>
          </div>
        </div>
        <main className={styles.main}>
          <p className={styles.loading}>Loading your answers…</p>
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
    <div className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.barTop}>
          <h1 className={styles.title}>{quizTitle}</h1>
          <p
            className={`${styles.timer} ${secondsLeft < 60 ? styles.lowTime : ''}`}
            aria-label={`Time left ${formatDuration(secondsLeft)}`}
          >
            {formatDuration(secondsLeft)}
          </p>
        </div>

        <div className={styles.barBottom}>
          <ol className={styles.strip} aria-label="Questions">
            {questions.map((q, index) => {
              const isAnswered = (answers[q.id] ?? []).length > 0
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className={`${styles.bubble} ${isAnswered ? styles.answered : ''}`}
                    aria-label={bubbleLabel(index, isAnswered)}
                    aria-current={index === current ? 'step' : undefined}
                    onClick={() => goTo(index)}
                  >
                    {index + 1}
                  </button>
                </li>
              )
            })}
          </ol>
          <p className={styles.count}>
            Question {current + 1} of {total}
          </p>
        </div>
      </div>

      <main className={styles.main}>
        {question && (
          <div key={question.id}>
            <p className={styles.number} aria-hidden="true">
              {current + 1}
            </p>
            <fieldset className={styles.fieldset}>
              <legend ref={promptRef} tabIndex={-1} className={styles.prompt}>
                {question.text}
              </legend>
              {multi && <p className={sheet.hint}>Pick all that apply</p>}

              <div className={styles.options}>
                {question.options.map((option, optionIndex) => (
                  <label key={option.id} className={styles.option}>
                    <input
                      className={sheet.input}
                      type={multi ? 'checkbox' : 'radio'}
                      name={question.id}
                      checked={(answers[question.id] ?? []).includes(option.id)}
                      onChange={() => toggleOption(question, option.id)}
                    />
                    <span className={`${sheet.mark} ${multi ? sheet.square : ''}`} aria-hidden="true">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    {option.text}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </main>

      <div className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.prev}>
            {current > 0 && (
              <Button variant="secondary" onClick={() => goTo(current - 1)}>
                ‹ Previous
              </Button>
            )}
          </div>

          <p className={styles.progress}>
            {isLast && unanswered > 0
              ? `${unanswered} ${unanswered === 1 ? 'question' : 'questions'} unanswered`
              : `${answered} of ${total} answered`}
          </p>

          <div className={styles.next}>
            {isLast ? (
              <Button onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit answers'}
              </Button>
            ) : (
              <Button onClick={() => goTo(current + 1)}>Next ›</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
