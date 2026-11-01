'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { readErrorBody } from '@/lib/errorBody'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export function DeleteQuizButton({ quizId }: { quizId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // runs only after the dialog is confirmed: deleting a quiz is irreversible
  async function handleDelete() {
    setOpen(false)
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
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={<Button variant="ghost" size="sm" className="text-destructive" disabled={pending} />}
        >
          {pending ? 'Deleting…' : 'Delete'}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <p role="alert" className="mt-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
