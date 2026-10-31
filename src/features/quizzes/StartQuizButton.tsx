'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, ErrorMessage } from '@/ui'

export function StartQuizButton({
  quizId,
  label,
  variant = 'primary',
}: {
  quizId: string
  label: string
  variant?: 'primary' | 'secondary'
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)

    const res = await fetch(`/api/quizzes/${quizId}/start`, { method: 'POST' })
    const body = await res.json()

    setPending(false)

    if (res.ok) {
      router.push(`/quizzes/${quizId}/take/${body.attemptId}`)
      return
    }

    if (res.status === 409 && body.attemptId) {
      const destination = body.resume
        ? `/quizzes/${quizId}/take/${body.attemptId}`
        : `/quizzes/${quizId}/result/${body.attemptId}`
      router.push(destination)
      return
    }

    setError(body.error ?? 'Could not start the quiz.')
  }

  return (
    <div>
      <Button variant={variant} onClick={handleClick} disabled={pending}>
        {pending ? 'Starting...' : label}
      </Button>
      {error && <ErrorMessage size="small">{error}</ErrorMessage>}
    </div>
  )
}
