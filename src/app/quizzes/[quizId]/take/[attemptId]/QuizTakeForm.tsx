'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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

export function QuizTakeForm({ quizId, attemptId, quizTitle, questions, remainingSeconds }: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState<AnswersMap>({})
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds)
  const [submitting, setSubmitting] = useState(false)
  const submittedRef = useRef(false)

  useEffect(() => {
    const cached = localStorage.getItem(storageKey(attemptId))
    if (cached) setAnswers(JSON.parse(cached))
  }, [attemptId])

  useEffect(() => {
    localStorage.setItem(storageKey(attemptId), JSON.stringify(answers))
  }, [answers, attemptId])

  const submit = useMemo(
    () => async () => {
      if (submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)

      const payload = {
        answers: questions.map((q) => ({
          questionId: q.id,
          selectedOptionIds: answers[q.id] ?? [],
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
    },
    [answers, attemptId, quizId, questions, router],
  )

  useEffect(() => {
    if (secondsLeft <= 0) {
      submit()
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, submit])

  function toggleOption(question: TakeableQuestion, optionId: string) {
    setAnswers((prev) => {
      const current = prev[question.id] ?? []
      if (question.type === 'SINGLE_SELECT') {
        return { ...prev, [question.id]: [optionId] }
      }
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
      return { ...prev, [question.id]: next }
    })
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
