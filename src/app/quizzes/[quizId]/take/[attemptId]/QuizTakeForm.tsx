'use client'

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { TakeableQuestion } from '@/lib/quiz/queries'
import { formatDuration } from '@/lib/format'
import sheet from '../../../answerSheet.module.css'
import controls from '@/app/controls.module.css'
import styles from './take.module.css'

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

function readCachedAnswers(attemptId: string): AnswersMap {
  try {
    const cached = localStorage.getItem(storageKey(attemptId))
    return cached ? JSON.parse(cached) : {}
  } catch {
    return {}
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
          <h1 className={styles.title}>{props.quizTitle}</h1>
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
  const [deadline] = useState(() => Date.now() + remainingSeconds * 1000)
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds)
  const [submitting, setSubmitting] = useState(false)
  const answersRef = useRef(answers)
  const submittedRef = useRef(false)

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

  function toggleOption(question: TakeableQuestion, optionId: string) {
    const current = answers[question.id] ?? []
    const selected =
      question.type === 'SINGLE_SELECT'
        ? [optionId]
        : current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId]
    const next = { ...answers, [question.id]: selected }

    setAnswers(next)
    answersRef.current = next
    localStorage.setItem(storageKey(attemptId), JSON.stringify(next))
  }

  const answeredCount = questions.filter((q) => (answers[q.id] ?? []).length > 0).length
  const unansweredCount = questions.length - answeredCount

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <h1 className={styles.title}>{quizTitle}</h1>
        <p
          className={`${styles.timer} ${secondsLeft < 60 ? styles.lowTime : ''}`}
          aria-label={`Time left ${formatDuration(secondsLeft)}`}
        >
          {formatDuration(secondsLeft)}
        </p>
      </div>

      <main className={styles.main}>
        <ol className={sheet.questions}>
          {questions.map((question, index) => {
            const multi = question.type === 'MULTI_SELECT'

            return (
              <li key={question.id} className={sheet.question}>
                <span className={sheet.number}>{index + 1}</span>
                <fieldset className={styles.fieldset}>
                  <legend className={sheet.prompt}>{question.text}</legend>
                  {multi && <p className={sheet.hint}>Pick all that apply</p>}

                  <div className={sheet.options}>
                    {question.options.map((option, optionIndex) => (
                      <label key={option.id} className={`${sheet.option} ${sheet.choice}`}>
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
              </li>
            )
          })}
        </ol>

        <div className={styles.footer}>
          <p className={styles.progress}>
            {answeredCount} of {questions.length} answered
            {unansweredCount > 0 && (
              <span className={styles.unanswered}>
                {unansweredCount} {unansweredCount === 1 ? 'question' : 'questions'} unanswered
              </span>
            )}
          </p>
          <button type="button" className={controls.primary} onClick={submit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit answers'}
          </button>
        </div>
      </main>
    </div>
  )
}
