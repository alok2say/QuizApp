'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { readErrorBody } from '@/lib/errorBody'
import { Actions, Button, Notice, TextLink } from '@/ui'
import styles from './QuizJsonEditor.module.css'

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
    if (!window.confirm('This will replace the current editor content. Continue?')) {
      return
    }

    setText(await file.text())
  }

  return (
    <div>
      <details className={styles.help}>
        <summary>What goes in the JSON</summary>
        <ul>
          <li><code>title</code>, optional <code>description</code></li>
          <li><code>timeLimitSeconds</code>: a positive whole number</li>
          <li>
            <code>retakePolicy</code>: <code>UNLIMITED_BEST</code>, <code>UNLIMITED_LATEST</code>, or{' '}
            <code>SINGLE_ATTEMPT</code>
          </li>
          <li><code>feedbackMode</code>: <code>END_ONLY</code></li>
          <li><code>leaderboardSize</code>: optional, defaults to 10</li>
          <li>
            <code>questions</code>: each has <code>text</code>, <code>type</code> (<code>SINGLE_SELECT</code> with
            exactly one correct option, or <code>MULTI_SELECT</code>), optional <code>points</code> (defaults to
            10), and at least two <code>options</code> of <code>{'{ text, isCorrect }'}</code>
          </li>
        </ul>
      </details>

      <textarea
        className={styles.editor}
        aria-label="Quiz JSON"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {errors.length > 0 && (
        <Notice as="div" tone="danger" role="alert">
          <p>Fix these before saving:</p>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Notice>
      )}
      {serverError && (
        <Notice tone="danger" role="alert">{serverError}</Notice>
      )}
      <Actions gap="tight">
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save quiz'}
        </Button>
        <Button variant="secondary" onClick={handleDownload}>
          Download JSON
        </Button>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Upload JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileSelected}
          hidden
        />
        <span className={styles.cancel}>
          <TextLink href="/admin/quizzes">Cancel</TextLink>
        </span>
      </Actions>
    </div>
  )
}
