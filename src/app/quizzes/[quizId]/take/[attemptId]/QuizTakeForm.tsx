'use client'

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import type { TakeableQuestion } from '@/lib/quiz/queries'

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
      <main>
        <h1>{props.quizTitle}</h1>
        <p>Loading…</p>
      </main>
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

  return (
    <main>
      <h1>{quizTitle}</h1>
      <p>Time left: {secondsLeft}s</p>

      {questions.map((question) => (
        <fieldset key={question.id}>
          <legend>{question.text}</legend>
          {question.options.map((option) => (
            <label key={option.id}>
              <input
                type={question.type === 'SINGLE_SELECT' ? 'radio' : 'checkbox'}
                name={question.id}
                checked={(answers[question.id] ?? []).includes(option.id)}
                onChange={() => toggleOption(question, option.id)}
              />
              {option.text}
            </label>
          ))}
        </fieldset>
      ))}

      <button onClick={submit} disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Quiz'}
      </button>
    </main>
  )
}
