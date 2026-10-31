'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { withCallbackUrl } from '@/lib/safeRedirect'
import { Button, ErrorMessage, Field, Form, Input, Notice, Page, PageHeader, TextLink } from '@/ui'
import styles from './auth.module.css'

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
    <Page width="narrow" top="cover">
      <PageHeader size="cover" title="Log in" intro="Pick up where you left off." />

      {justCreated && <Notice tone="success">Account created. Log in to start.</Notice>}

      <Form onSubmit={handleSubmit}>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </Form>

      <p className={styles.switch}>
        New here? <TextLink href={withCallbackUrl('/signup', callbackUrl)}>Create an account</TextLink>
      </p>
    </Page>
  )
}
