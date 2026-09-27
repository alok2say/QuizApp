'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  initialJson: string
  submitUrl: string
  method: 'POST' | 'PUT'
}

export function QuizJsonEditor({ initialJson, submitUrl, method }: Props) {
  const router = useRouter()
  const [text, setText] = useState(initialJson)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit() {
    setErrors([])

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
    const body = await res.json()
    setErrors(body.errors ?? [body.error ?? 'Could not save the quiz.'])
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
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={30}
        cols={80}
      />
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}
      <div>
        <button onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </button>
        <button onClick={handleDownload} type="button">
          Download JSON
        </button>
        <button onClick={() => fileInputRef.current?.click()} type="button">
          Upload JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileSelected}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}
