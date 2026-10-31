'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { readErrorBody } from '@/lib/errorBody'
import { withCallbackUrl } from '@/lib/safeRedirect'
import controls from '@/app/controls.module.css'
import styles from '@/app/authForm.module.css'

// callbackUrl arrives already sanitized by the server page
export function SignupForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: name || undefined }),
    })

    setSubmitting(false)

    if (!res.ok) {
      const body = await readErrorBody(res)
      setError(body?.error ?? `Couldn't create the account (server error ${res.status}). Try again.`)
      return
    }

    const loginUrl = withCallbackUrl('/login', callbackUrl)
    router.push(`${loginUrl}${loginUrl.includes('?') ? '&' : '?'}created=1`)
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Create an account</h1>
        <p className={styles.intro}>Takes a few seconds. No email check.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            Name (optional)
            <input
              className={styles.input}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            Email
            <input
              className={styles.input}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            Password
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className={styles.help}>At least 8 characters</span>
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={controls.primary} disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link href={withCallbackUrl('/login', callbackUrl)}>Log in</Link>
        </p>
      </main>
    </div>
  )
}
