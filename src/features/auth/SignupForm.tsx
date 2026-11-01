'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { readErrorBody } from '@/lib/errorBody'
import { withCallbackUrl } from '@/lib/safeRedirect'
import { Button, ErrorMessage, Field, Form, Input, Page, PageHeader, TextLink } from '@/ui'
import styles from './auth.module.css'

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
    <Page width="narrow">
      <PageHeader title="Create an account" description="Takes a few seconds. No email check." />

      <Form onSubmit={handleSubmit}>
        <Field label="Name (optional)">
          <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" help="At least 8 characters">
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </Form>

      <p className={styles.switch}>
        Already have an account? <TextLink href={withCallbackUrl('/login', callbackUrl)}>Log in</TextLink>
      </p>
    </Page>
  )
}
