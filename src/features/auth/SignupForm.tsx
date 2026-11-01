'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { readErrorBody } from '@/lib/errorBody'
import { withCallbackUrl } from '@/lib/safeRedirect'
import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Page } from '@/ui'

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
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
          </CardTitle>
          <CardDescription>Takes a few seconds. No email check.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="signup-name">Name (optional)</FieldLabel>
                <Input id="signup-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-email">Email</FieldLabel>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="signup-password">Password</FieldLabel>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  aria-describedby="signup-password-help"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FieldDescription id="signup-password-help">At least 8 characters</FieldDescription>
              </Field>
              {error && (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create account'}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-muted-foreground">
          <p>
            Already have an account?{' '}
            <Link className="text-foreground underline underline-offset-4" href={withCallbackUrl('/login', callbackUrl)}>
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </Page>
  )
}
