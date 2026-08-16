# Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js project, database schema, and Credentials-based authentication (with role-based route protection) that every later feature (MCQ engine, admin authoring, leaderboard, home page) depends on.

**Architecture:** A single Next.js (App Router, TypeScript) monolith. Prisma defines and queries the Postgres schema (all models from the spec: `User`, `Quiz`, `Question`, `Option`, `Attempt`, `AttemptAnswer`). NextAuth (Auth.js) v4 handles login sessions using the Credentials provider with JWT session strategy — no database adapter, since Credentials-only setups aren't well-supported by NextAuth's DB session adapters. Our own code (via Prisma) handles password hashing, user creation, and credential verification; NextAuth wraps that in session/cookie management. Middleware gates `/admin/*` routes by role.

**Tech Stack:** Next.js (App Router) + TypeScript, Prisma + PostgreSQL (Neon/Supabase free tier), NextAuth v4 (Credentials provider, JWT sessions), bcrypt (password hashing), zod (input validation), Vitest (unit tests).

**Spec:** `/Users/alranjan/AlokPersonalRepo/brainstrom-webapp-idea/SPEC.md` — see "Tech Stack", "Feature: Auth", and the `User`/data-model portion of "Feature: MCQ Quiz Engine → Data Model".

## Global Constraints

- TypeScript throughout — no `.js` source files.
- Next.js App Router (not Pages Router).
- Cost must stay at $0 at current scale — Postgres via Neon/Supabase free tier, hosting via Vercel free tier (hosting/deploy setup is out of scope for this plan; local dev + a provisioned free-tier DB is enough here).
- Auth is Credentials-only (email + password) for v1 — no social providers.
- Session strategy is JWT, not database sessions (NextAuth Prisma Adapter is NOT used, per the corrected spec).
- `User.role` is `USER | ADMIN`; only role-based authorization exists — no fine-grained permissions.
- Passwords must be hashed with bcrypt — never stored or compared in plaintext.
- Every Prisma model needed by later plans (Quiz/Question/Option/Attempt/AttemptAnswer) must exist in the schema now, even though this plan only builds User-facing auth — later plans should not need schema changes for their core models.

---

## File Structure

- `prisma/schema.prisma` — all data models (User + full MCQ model set)
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/password.ts` — `hashPassword` / `verifyPassword` (bcrypt wrappers)
- `src/lib/credentials.ts` — `verifyCredentials(email, password)`: looks up a user via Prisma and checks their password; the pure-ish piece NextAuth's `authorize()` delegates to, kept separate so it's unit-testable without invoking NextAuth internals
- `src/lib/auth.ts` — `authOptions` (NextAuthOptions): Credentials provider wired to `verifyCredentials`, JWT session strategy, callbacks that attach `id`/`role` to the token and session
- `src/types/next-auth.d.ts` — module augmentation adding `id`/`role` to NextAuth's `Session`/`JWT`/`User` types
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler (GET/POST)
- `src/app/api/signup/route.ts` — POST handler: validate input (zod), reject duplicate email, hash password, create `User`
- `src/app/signup/page.tsx` — signup form (client component)
- `src/app/login/page.tsx` — login form (client component), calls `signIn('credentials', ...)`
- `src/lib/authorization.ts` — `isAuthorizedForPath(pathname, role)`: pure decision function (e.g. `/admin` requires `ADMIN`) — unit-tested in isolation, then used by middleware
- `src/middleware.ts` — Next.js middleware wiring `isAuthorizedForPath` to actual request handling/redirects
- `.env.example` — documents `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

---

### Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.eslintrc.json`, `.gitignore`
- Create: `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx` (default Next.js App Router pages, no real content yet — Home page real content is out of scope, per spec)
- Test: `src/lib/smoke.test.ts`

**Interfaces:**
- Produces: a runnable Next.js dev server (`npm run dev`) and a working test runner (`npm test`) that every later task builds on.

- [ ] **Step 1: Scaffold the Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --app --eslint --src-dir --import-alias "@/*" --no-tailwind
```
When prompted, accept defaults. This creates `package.json`, `tsconfig.json`, `next.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `.eslintrc.json`, `.gitignore`.

- [ ] **Step 2: Install additional dependencies**

Run:
```bash
npm install next-auth@^4 bcrypt zod @prisma/client
npm install -D prisma vitest @vitejs/plugin-react vite-tsconfig-paths @types/bcrypt
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
})
```

Add to `package.json` `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 4: Write a smoke test to confirm the test runner works**

Create `src/lib/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('smoke test', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run the smoke test to confirm it passes**

Run: `npm test`
Expected: PASS — `smoke test > runs`

- [ ] **Step 6: Confirm the dev server boots**

Run: `npm run dev`, visit `http://localhost:3000`, confirm the default Next.js page loads. Stop the server (Ctrl+C).

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project with TypeScript and Vitest"
```

---

### Task 2: Prisma schema + client singleton

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `.env.example`
- Modify: `.gitignore` (ensure `.env` is ignored — `create-next-app` already ignores it, verify)

**Interfaces:**
- Produces: `prisma` (default export from `src/lib/prisma.ts`) — a `PrismaClient` instance every later task imports to query the DB. Models: `User`, `Quiz`, `Question`, `Option`, `Attempt`, `AttemptAnswer`, enums `Role`, `RetakePolicy`, `FeedbackMode`, `QuestionType`.

- [ ] **Step 1: Write the full Prisma schema**

Create `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

enum RetakePolicy {
  UNLIMITED_BEST
  UNLIMITED_LATEST
  SINGLE_ATTEMPT
}

enum FeedbackMode {
  END_ONLY
  IMMEDIATE
}

enum QuestionType {
  SINGLE_SELECT
  MULTI_SELECT
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String?
  role         Role      @default(USER)
  createdAt    DateTime  @default(now())
  attempts     Attempt[]
}

model Quiz {
  id               String       @id @default(cuid())
  title            String
  description      String?
  timeLimitSeconds Int
  retakePolicy     RetakePolicy
  feedbackMode     FeedbackMode
  maxScore         Int          @default(0)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  questions        Question[]
  attempts         Attempt[]
}

model Question {
  id             String          @id @default(cuid())
  quizId         String
  quiz           Quiz            @relation(fields: [quizId], references: [id], onDelete: Cascade)
  text           String
  order          Int
  type           QuestionType
  points         Int
  options        Option[]
  attemptAnswers AttemptAnswer[]
}

model Option {
  id         String   @id @default(cuid())
  questionId String
  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  text       String
  isCorrect  Boolean
}

model Attempt {
  id                    String          @id @default(cuid())
  quizId                String
  quiz                  Quiz            @relation(fields: [quizId], references: [id])
  userId                String
  user                  User            @relation(fields: [userId], references: [id])
  startedAt             DateTime        @default(now())
  submittedAt           DateTime?
  completionSeconds     Int?
  score                 Int             @default(0)
  isLeaderboardEligible Boolean         @default(false)
  answers               AttemptAnswer[]

  @@index([quizId, isLeaderboardEligible])
}

model AttemptAnswer {
  id                String   @id @default(cuid())
  attemptId         String
  attempt           Attempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  questionId        String
  question          Question @relation(fields: [questionId], references: [id])
  selectedOptionIds String[]
  isCorrect         Boolean
  pointsAwarded     Int

  @@unique([attemptId, questionId])
}
```

- [ ] **Step 2: Document required environment variables**

Create `.env.example`:
```
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
NEXTAUTH_SECRET="replace-with-a-random-32-byte-base64-string"
NEXTAUTH_URL="http://localhost:3000"
```

- [ ] **Step 3: Provision a free-tier Postgres instance and set `.env`**

Create a free Postgres database on Neon (neon.tech) or Supabase. Copy `.env.example` to `.env` and fill in the real `DATABASE_URL` from the provider dashboard. Generate a secret for `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

- [ ] **Step 4: Run the initial migration**

Run:
```bash
npx prisma migrate dev --name init
```
Expected: prints "Your database is now in sync with your schema" and creates `prisma/migrations/<timestamp>_init/`.

- [ ] **Step 5: Verify tables were created**

Run: `npx prisma studio`, confirm `User`, `Quiz`, `Question`, `Option`, `Attempt`, `AttemptAnswer` tables are listed. Close Prisma Studio.

- [ ] **Step 6: Create the Prisma client singleton**

Create `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

(The global caching avoids exhausting DB connections from repeated hot-reload instantiation in dev — a standard Next.js + Prisma pattern.)

- [ ] **Step 7: Confirm `.env` is gitignored**

Run: `git check-ignore .env`
Expected: prints `.env` (confirming it is ignored). If it prints nothing, add `.env` to `.gitignore` and re-run.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/prisma.ts .env.example .gitignore
git commit -m "feat: add Prisma schema for all data models and DB client singleton"
```

---

### Task 3: Password hashing utility

**Files:**
- Create: `src/lib/password.ts`
- Test: `src/lib/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`, `verifyPassword(plain: string, hash: string): Promise<boolean>` — used by Task 4 (signup) and Task 5 (credential verification).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/password.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password hashing', () => {
  it('produces a hash different from the plaintext', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(hash).not.toBe('correct-horse-battery-staple')
  })

  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
  })

  it('rejects an incorrect password against a hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/password.test.ts`
Expected: FAIL — `Cannot find module './password'`

- [ ] **Step 3: Implement the utility**

Create `src/lib/password.ts`:
```typescript
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/password.test.ts`
Expected: PASS — all 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/password.ts src/lib/password.test.ts
git commit -m "feat: add bcrypt-based password hashing utility"
```

---

### Task 4: Signup logic + API route

**Files:**
- Create: `src/app/api/signup/route.ts`
- Test: `src/app/api/signup/route.test.ts`

**Interfaces:**
- Consumes: `hashPassword` from `src/lib/password.ts` (Task 3), `prisma` from `src/lib/prisma.ts` (Task 2).
- Produces: `POST /api/signup` — accepts `{ email: string, password: string, name?: string }`, returns `201` with `{ id, email, name }` on success, `400` with `{ error: string }` on validation failure or duplicate email.

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/signup/route.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/signup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid input', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: '123' }))
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as any)
    const res = await POST(makeRequest({ email: 'taken@example.com', password: 'longenough1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already/i)
  })

  it('creates a user with a hashed password on valid input', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new-user',
      email: 'new@example.com',
      name: null,
    } as any)

    const res = await POST(makeRequest({ email: 'new@example.com', password: 'longenough1' }))
    expect(res.status).toBe(201)

    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0]
    expect(createArgs.data.email).toBe('new@example.com')
    expect(createArgs.data.passwordHash).not.toBe('longenough1')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/app/api/signup/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implement the route**

Create `src/app/api/signup/route.ts`:
```typescript
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

export async function POST(request: Request) {
  const json = await request.json()
  const parsed = signupSchema.safeParse(json)

  if (!parsed.success) {
    return Response.json({ error: 'Invalid email or password (min 8 characters).' }, { status: 400 })
  }

  const { email, password, name } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'An account with this email already exists.' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  })

  return Response.json({ id: user.id, email: user.email, name: user.name }, { status: 201 })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/app/api/signup/route.test.ts`
Expected: PASS — all 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/app/api/signup/route.ts src/app/api/signup/route.test.ts
git commit -m "feat: add signup API route with validation and password hashing"
```

---

### Task 5: Credential verification + NextAuth configuration

**Files:**
- Create: `src/lib/credentials.ts`
- Test: `src/lib/credentials.test.ts`
- Create: `src/lib/auth.ts`
- Create: `src/types/next-auth.d.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `verifyPassword` (Task 3).
- Produces: `verifyCredentials(email: string, password: string): Promise<{ id: string, email: string, role: 'USER' | 'ADMIN' } | null>` — used by `authOptions`. `authOptions: NextAuthOptions` — used by the route handler and later by middleware/session reads in every other plan.

- [ ] **Step 1: Write the failing tests for credential verification**

Create `src/lib/credentials.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyCredentials } from './credentials'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/password', () => ({
  verifyPassword: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'

describe('verifyCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no user matches the email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const result = await verifyCredentials('nobody@example.com', 'password123')
    expect(result).toBeNull()
  })

  it('returns null when the password does not match', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hashed',
      role: 'USER',
    } as any)
    vi.mocked(verifyPassword).mockResolvedValue(false)
    const result = await verifyCredentials('user@example.com', 'wrong')
    expect(result).toBeNull()
  })

  it('returns the user id/email/role when the password matches', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hashed',
      role: 'ADMIN',
    } as any)
    vi.mocked(verifyPassword).mockResolvedValue(true)
    const result = await verifyCredentials('user@example.com', 'correct')
    expect(result).toEqual({ id: 'u1', email: 'user@example.com', role: 'ADMIN' })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/credentials.test.ts`
Expected: FAIL — `Cannot find module './credentials'`

- [ ] **Step 3: Implement `verifyCredentials`**

Create `src/lib/credentials.ts`:
```typescript
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'

export async function verifyCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string; role: 'USER' | 'ADMIN' } | null> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return null

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null

  return { id: user.id, email: user.email, role: user.role as 'USER' | 'ADMIN' }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/credentials.test.ts`
Expected: PASS — all 3 tests

- [ ] **Step 5: Add NextAuth type augmentation**

Create `src/types/next-auth.d.ts`:
```typescript
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'USER' | 'ADMIN'
    } & DefaultSession['user']
  }
  interface User {
    id: string
    role: 'USER' | 'ADMIN'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'USER' | 'ADMIN'
  }
}
```

- [ ] **Step 6: Write `authOptions`**

Create `src/lib/auth.ts`:
```typescript
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { verifyCredentials } from '@/lib/credentials'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await verifyCredentials(credentials.email, credentials.password)
        return user
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.role = token.role
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
}
```

- [ ] **Step 7: Wire up the NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

- [ ] **Step 8: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: PASS — all tests across all files

- [ ] **Step 9: Commit**

```bash
git add src/lib/credentials.ts src/lib/credentials.test.ts src/lib/auth.ts src/types/next-auth.d.ts src/app/api/auth
git commit -m "feat: add NextAuth Credentials provider with JWT sessions and role typing"
```

---

### Task 6: Login and signup pages

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/signup/page.tsx`

**Interfaces:**
- Consumes: `signIn` from `next-auth/react` (login page), `POST /api/signup` (signup page, Task 4).
- Produces: working `/login` and `/signup` pages — this task is UI-only and verified manually in the browser, not via unit test (no meaningful pure logic to unit-test here beyond what Tasks 3–5 already cover).

- [ ] **Step 1: Build the signup page**

Create `src/app/signup/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
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
      const body = await res.json()
      setError(body.error ?? 'Signup failed.')
      return
    }

    router.push('/login')
  }

  return (
    <main>
      <h1>Sign up</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Name (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing up...' : 'Sign up'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: Build the login page**

Create `src/app/login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
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
      setError('Invalid email or password.')
      return
    }

    router.push('/')
  }

  return (
    <main>
      <h1>Log in</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Wrap the app in NextAuth's SessionProvider**

Modify `src/app/layout.tsx` to wrap children in a client-side session provider component. Create `src/app/providers.tsx`:
```tsx
'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

Modify `src/app/layout.tsx` — wrap the existing `{children}` with `<Providers>`:
```tsx
import { Providers } from './providers'
// ...existing imports...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Manually verify the signup → login flow in the browser**

Run: `npm run dev`
1. Visit `http://localhost:3000/signup`, create an account with a real email/password (8+ chars).
2. Confirm redirect to `/login`.
3. Log in with the same credentials. Confirm redirect to `/` with no error.
4. Open Prisma Studio (`npx prisma studio`) and confirm the new row exists in `User` with a non-plaintext `passwordHash`.
5. Try logging in again with a wrong password — confirm the "Invalid email or password" error shows and no redirect happens.

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/app/signup/page.tsx src/app/providers.tsx src/app/layout.tsx
git commit -m "feat: add login and signup pages wired to NextAuth"
```

---

### Task 7: Role-based route protection middleware

**Files:**
- Create: `src/lib/authorization.ts`
- Test: `src/lib/authorization.test.ts`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (pure function), but conceptually mirrors the `role` shape produced by Task 5's JWT/session callbacks.
- Produces: `isAuthorizedForPath(pathname: string, role: 'USER' | 'ADMIN' | null): boolean` — pure authorization decision, used by `src/middleware.ts`. This is what later plans' route additions (e.g. `/quizzes`, `/admin/quizzes`) rely on for protection semantics.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/authorization.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { isAuthorizedForPath } from './authorization'

describe('isAuthorizedForPath', () => {
  it('allows anyone to access public paths', () => {
    expect(isAuthorizedForPath('/', null)).toBe(true)
    expect(isAuthorizedForPath('/login', null)).toBe(true)
    expect(isAuthorizedForPath('/signup', null)).toBe(true)
  })

  it('denies unauthenticated users on protected paths', () => {
    expect(isAuthorizedForPath('/quizzes', null)).toBe(false)
    expect(isAuthorizedForPath('/admin/quizzes', null)).toBe(false)
  })

  it('allows any logged-in user on general protected paths', () => {
    expect(isAuthorizedForPath('/quizzes', 'USER')).toBe(true)
    expect(isAuthorizedForPath('/quizzes/123', 'USER')).toBe(true)
  })

  it('denies non-admin users on admin paths', () => {
    expect(isAuthorizedForPath('/admin/quizzes', 'USER')).toBe(false)
  })

  it('allows admin users on admin paths', () => {
    expect(isAuthorizedForPath('/admin/quizzes', 'ADMIN')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/lib/authorization.test.ts`
Expected: FAIL — `Cannot find module './authorization'`

- [ ] **Step 3: Implement the authorization decision function**

Create `src/lib/authorization.ts`:
```typescript
const PUBLIC_PATHS = ['/', '/login', '/signup']

export function isAuthorizedForPath(pathname: string, role: 'USER' | 'ADMIN' | null): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true

  if (pathname.startsWith('/admin')) {
    return role === 'ADMIN'
  }

  // Any other path (e.g. /quizzes, /quizzes/[id], /quizzes/[id]/leaderboard)
  // requires any logged-in user.
  return role === 'USER' || role === 'ADMIN'
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/lib/authorization.test.ts`
Expected: PASS — all 5 tests

- [ ] **Step 5: Wire the decision function into Next.js middleware**

Create `src/middleware.ts`:
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAuthorizedForPath } from '@/lib/authorization'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const role = (token?.role as 'USER' | 'ADMIN' | undefined) ?? null

  if (isAuthorizedForPath(request.nextUrl.pathname, role)) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/quizzes/:path*', '/admin/:path*'],
}
```

(The `matcher` only lists paths that exist or will exist under the MCQ/admin plans — `/` and `/login`/`/signup` don't need to be matched at all since they're always public.)

- [ ] **Step 6: Manually verify middleware redirect behavior**

Run: `npm run dev`
1. While logged out, visit `http://localhost:3000/quizzes` (it will 404 since the page doesn't exist yet in this plan — confirm you're redirected to `/login` *before* hitting any 404, i.e. the middleware runs first).
2. Log in as a regular (`USER`) account, visit `/admin/quizzes` — confirm redirect to `/login` (middleware still blocks it since role isn't `ADMIN`; note this is a redirect-to-login, not a 403 — acceptable for v1).
3. Using Prisma Studio, manually edit that user's `role` to `ADMIN`, log out and back in (JWT is issued at login, so the role change requires a fresh session), then revisit `/admin/quizzes` — confirm no redirect this time (still 404 since the page doesn't exist yet, but no redirect to `/login`).

Stop the dev server.

- [ ] **Step 7: Run the full test suite one final time**

Run: `npm test`
Expected: PASS — all tests across all files (smoke, password, signup route, credentials, authorization)

- [ ] **Step 8: Commit**

```bash
git add src/lib/authorization.ts src/lib/authorization.test.ts src/middleware.ts
git commit -m "feat: add role-based route protection middleware"
```

---

## Plan Complete

At the end of this plan: a running Next.js + TypeScript app with a full Prisma schema (all MCQ models provisioned, even though only `User` is used yet), working signup/login backed by bcrypt + NextAuth JWT sessions, and role-based middleware protecting `/quizzes/*` and `/admin/*` path prefixes — ready for the **MCQ Core** plan to build real pages under those protected paths.
