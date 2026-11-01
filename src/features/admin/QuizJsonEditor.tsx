'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readErrorBody } from '@/lib/errorBody'
import Link from 'next/link'
import { ChevronDown, CircleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Props = {
  initialJson: string
  submitUrl: string
  method: 'POST' | 'PUT'
}

export function QuizJsonEditor({ initialJson, submitUrl, method }: Props) {
  const router = useRouter()
  const [text, setText] = useState(initialJson)
  const [errors, setErrors] = useState<string[]>([])
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // an uploaded file's text, waiting for the user to confirm the replace
  const [pendingUpload, setPendingUpload] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    setErrors([])
    setServerError(null)

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      // catch syntax errors before a network call — the server would reject it anyway
      setErrors(['Invalid JSON syntax.'])
      return
    }

    setSubmitting(true)

    const res = await fetch(submitUrl, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    })

    setSubmitting(false)

    if (res.ok) {
      router.push('/admin/quizzes')
      return
    }

    // server validation failed — show the specific errors, keep the typed text intact
    const body = await readErrorBody(res)
    if (body?.errors) {
      setErrors(body.errors)
    } else {
      setServerError(body?.error ?? `Couldn't save the quiz (server error ${res.status}). Your edits are still here.`)
    }
  }

  function handleDownload() {
    // derive the filename from the content's own title when possible,
    // since this works on unsaved edits that may not even be valid JSON yet
    let filename = 'quiz.json'
    try {
      const parsed = JSON.parse(text)
      if (typeof parsed?.title === 'string' && parsed.title.trim()) {
        const slug = parsed.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        if (slug) filename = `${slug}.json`
      }
    } catch {
      // not valid JSON yet — fall back to the generic filename
    }

    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // reset so picking the same file again still fires onChange
    if (!file) return

    // full-replace, same as Save's own semantics — confirm since it can discard unsaved edits
    setPendingUpload(await file.text())
  }

  return (
    <div className="space-y-4">
      <Collapsible>
        <CollapsibleTrigger render={<Button variant="ghost" className="-ml-2.5" />}>
          What goes in the JSON
          <ChevronDown />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li><code className="font-mono text-foreground">title</code>, optional <code className="font-mono text-foreground">description</code></li>
            <li><code className="font-mono text-foreground">timeLimitSeconds</code>: a positive whole number</li>
            <li>
              <code className="font-mono text-foreground">retakePolicy</code>: <code className="font-mono text-foreground">UNLIMITED_BEST</code>,{' '}
              <code className="font-mono text-foreground">UNLIMITED_LATEST</code>, or <code className="font-mono text-foreground">SINGLE_ATTEMPT</code>
            </li>
            <li><code className="font-mono text-foreground">feedbackMode</code>: <code className="font-mono text-foreground">END_ONLY</code></li>
            <li><code className="font-mono text-foreground">leaderboardSize</code>: optional, defaults to 10</li>
            <li>
              <code className="font-mono text-foreground">questions</code>: each has <code className="font-mono text-foreground">text</code>,{' '}
              <code className="font-mono text-foreground">type</code> (<code className="font-mono text-foreground">SINGLE_SELECT</code> with exactly one correct
              option, or <code className="font-mono text-foreground">MULTI_SELECT</code>), optional{' '}
              <code className="font-mono text-foreground">points</code> (defaults to 10), and at least two{' '}
              <code className="font-mono text-foreground">options</code> of <code className="font-mono text-foreground">{'{ text, isCorrect }'}</code>
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      <Textarea
        className="min-h-96 font-mono text-sm"
        aria-label="Quiz JSON"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {errors.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Fix these before saving:</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {serverError && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save quiz'}
        </Button>
        <Button variant="outline" onClick={handleDownload}>
          Download JSON
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          Upload JSON
        </Button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileSelected} hidden />
        <Link href="/admin/quizzes" className={cn(buttonVariants({ variant: 'link' }), 'ml-auto')}>
          Cancel
        </Link>
      </div>

      <AlertDialog open={pendingUpload !== null} onOpenChange={(open) => !open && setPendingUpload(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the editor content?</AlertDialogTitle>
            <AlertDialogDescription>This will replace the current editor content. Continue?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingUpload !== null) setText(pendingUpload)
                setPendingUpload(null)
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
