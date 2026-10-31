'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { readErrorBody } from '@/lib/errorBody'
import { ErrorMessage, TextButton } from '@/ui'

export function DeleteQuizButton({ quizId }: { quizId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    // confirm first — deleting a quiz is irreversible, no undo
    if (!window.confirm('Delete this quiz? This cannot be undone.')) {
      return
    }

    setPending(true)
    setError(null)

    const res = await fetch(`/api/admin/quizzes/${quizId}`, { method: 'DELETE' })

    if (res.ok) {
      // re-runs the server component's data fetch, no full reload
      router.refresh()
      return
    }

    setPending(false)
    const body = await readErrorBody(res)
    setError(body?.error ?? `Couldn't delete the quiz (server error ${res.status}).`)
  }

  return (
    <div>
      <TextButton tone="danger" onClick={handleClick} disabled={pending}>
        {pending ? 'Deleting…' : 'Delete'}
      </TextButton>
      {error && <ErrorMessage size="small">{error}</ErrorMessage>}
    </div>
  )
}
