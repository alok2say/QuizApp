'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { withCallbackUrl } from '@/lib/safeRedirect'
import controls from '@/app/controls.module.css'
import styles from '@/app/authForm.module.css'

// callbackUrl arrives already sanitized by the server page
export function LoginForm({ callbackUrl, justCreated }: { callbackUrl: string; justCreated: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setSubmitting(false)

    if (result?.error) {
      setError("That email and password don't match. Try again or create an account.")
      return
    }

    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Log in</h1>
        <p className={styles.intro}>Pick up where you left off.</p>

        {justCreated && <p className={styles.notice}>Account created. Log in to start.</p>}

        <form className={styles.form} onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={controls.primary} disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className={styles.switch}>
          New here? <Link href={withCallbackUrl('/signup', callbackUrl)}>Create an account</Link>
        </p>
      </main>
    </div>
  )
}
