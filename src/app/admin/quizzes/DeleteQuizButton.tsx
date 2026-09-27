'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
    const body = await res.json()
    setError(body.error ?? 'Could not delete the quiz.')
  }

  return (
    <div>
      <button onClick={handleClick} disabled={pending}>
        {pending ? 'Deleting...' : 'Delete'}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
