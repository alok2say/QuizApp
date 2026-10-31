# Learning Log — Project Foundation

Purpose: a step-by-step record of **what we did and why**, for the
learning goal of this project (see `SPEC.md` intro / project memory).
This complements `CONTEXT.md` (session continuity / where we are) — this
file is the durable "why" behind each concrete step, in execution order.
Plan being executed: `docs/superpowers/plans/2026-08-16-project-foundation.md`.

---

## Task 1: Project scaffold + tooling

### Step 1 — Scaffold the Next.js project
```bash
npx create-next-app@latest . --typescript --app --eslint --src-dir --import-alias "@/*" --no-tailwind
```
**Why:** This is the standard, officially-supported way to bootstrap a
Next.js project — it wires up the build config, TypeScript config, ESLint
config, and the App Router folder convention correctly in one shot, so we
don't hand-assemble a `next.config`/`tsconfig` from scratch and risk
subtle misconfiguration. Flags chosen deliberately:
- `--typescript` — project convention is TS throughout, no `.js` sources.
- `--app` — the App Router (not the older Pages Router), Next.js's
  current recommended architecture.
- `--src-dir` — keeps app code under `src/`, separate from root-level
  config files, for a cleaner top-level listing as the project grows.
- `--import-alias "@/*"` — lets code import as `@/lib/prisma` instead of
  relative paths like `../../lib/prisma`, which stays readable as the
  folder tree deepens.
- `--no-tailwind` — not using Tailwind for this project (no styling
  framework decision made yet; kept out so it's not the default).

Hit a snag: `create-next-app` refuses to run in a directory it doesn't
consider "empty" — `CONTEXT.md`/`SPEC.md` (our own planning docs) tripped
that check. Worked around it by moving them out temporarily and back
after scaffolding; not a real conflict, just an overly strict emptiness
check in the tool.

### Step 2 — Install additional dependencies
```bash
npm install next-auth@^4 bcrypt zod @prisma/client
npm install -D prisma vitest @vitejs/plugin-react vite-tsconfig-paths @types/bcrypt
```
**Why:** `create-next-app` only installs the Next.js core (next/react/
react-dom). Everything else this plan needs is added explicitly:
- `next-auth@^4` — handles login sessions/cookies; pinned to v4
  deliberately (v5/Auth.js beta has a different, less battle-tested API
  for Credentials-only setups, which is what this project uses).
- `bcrypt` — industry-standard password hashing; never store/compare
  plaintext passwords.
- `zod` — runtime input validation (e.g. signup form data) with
  TypeScript-inferred types, so validation logic and types can't drift.
- `@prisma/client` — the generated, type-safe DB query client Prisma
  produces from `schema.prisma` (added in Task 2).
- `-D prisma` — the Prisma CLI (migrations, schema generation); dev-only,
  not needed at runtime.
- `-D vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths` — the test
  runner and its supporting plugins (see Step 3 below for why Vitest).
- `-D @types/bcrypt` — TypeScript type definitions for `bcrypt`, which
  ships without its own types.

### Step 3 — Configure Vitest
**Why:** Next.js doesn't include a test runner out of the box. We chose
Vitest over Jest because it reuses Vite's fast esbuild-based transform
pipeline (near-instant TS/ESM support, no separate Babel/ts-jest config
needed) — less setup friction for a learning project where we want to
focus on app code, not test-tooling config. `vite-tsconfig-paths` is
required specifically because `tsconfig.json` defines the `@/*` import
alias (from Step 1) — without teaching Vitest to resolve that alias, any
test file importing app code via `@/...` would fail to resolve the
module. The `"test": "vitest run"` script in `package.json` gives the
project one conventional command (`npm test`) instead of relying on
everyone remembering the raw `npx vitest run` invocation.

### Step 4 — Write a smoke test
**Why:** This test doesn't assert anything about our app's logic — it
only proves the test *runner itself* works end-to-end (Vitest can find
the file, execute it, report a result) before we start writing tests with
real logic in Task 3 onward. If a later real test fails, we want to
already know the harness isn't the problem.

### Step 5 — Run the smoke test
Ran `npm test` — 1/1 passed, confirming Vitest + the tsconfig-paths
resolution work end-to-end. Two informational Vite warnings appeared
(config file could be `.mjs`/ESM, `vite-tsconfig-paths` could be replaced
by a native Vite option) — left as-is; they're forward-compatibility
notices, not errors, and not worth spending time on for a learning-stage
setup.

### Step 6 — Confirm the dev server boots
Ran `npm run dev`, visited `localhost:3000`, confirmed the default Next.js
starter page rendered. Confirms the scaffold is actually runnable, not
just correct-looking files on disk.

### Step 7 — Commit
Committed the scaffold. Along the way, `.serena/` (Serena MCP tool config,
unrelated to the app) got staged and committed by accident before we
gitignored it — fixed with a follow-up commit (`git rm -r --cached
.serena`) that removes it from tracking without deleting it from disk.
Lesson: check `git status` right before committing, not just when first
staging — state can shift between the two if commands run out of order.

**Task 1 complete.** Next: Task 2 (Prisma schema + client singleton).

---

## Task 2: Prisma schema + client singleton

### Step 1 — Write the full Prisma schema
Wrote `prisma/schema.prisma` with all models from `SPEC.md` (`User`,
`Quiz`, `Question`, `Option`, `Attempt`, `AttemptAnswer`) even though only
`User` is needed for this task's auth goal. **Why:** Prisma migrations are
additive and simplest to reason about when the full shape is defined up
front — adding models later means a second migration touching foreign
keys that already exist. Notable choices: `cuid()` IDs (collision-
resistant, no DB round-trip, don't leak row count/order like auto-
increment integers); `onDelete: Cascade` on `Question→Quiz` and
`Option→Question` but deliberately *not* on `Attempt` relations (deleting
a quiz shouldn't silently wipe historical attempt records); the
`isLeaderboardEligible` flag + composite index — the denormalized
leaderboard-eligibility flag from `SPEC.md`, letting leaderboard queries
filter on an indexed boolean instead of recomputing "is this the user's
best attempt" on every read; `@@unique([attemptId, questionId])` enforces
"one answer per question per attempt" at the DB level rather than trusting
application code.

### Step 2 — Document environment variables
Created `.env.example` (committed) documenting `DATABASE_URL`,
`NEXTAUTH_SECRET`, `NEXTAUTH_URL` without real values — versus the real
`.env` (gitignored, Step 3) which holds actual secrets.

### Step 3 — Provision Postgres + real `.env` (with detours)
Provisioned a free-tier Supabase Postgres project and filled in `.env`.
Hit several real-world snags worth remembering:
- **Direct connection blocked**: `db.<ref>.supabase.co:5432` requires
  IPv6; many networks block it. Fix: use Supabase's **connection
  pooler** host (`aws-0-<region>.pooler.supabase.com`) instead, which
  works over IPv4.
- **`@` in password breaks the URL**: a password containing a literal
  `@` character collides with the `@` that separates credentials from
  host in a connection-string URL, silently corrupting the parsed
  username/host. Fix: regenerate a password without special characters
  needing percent-encoding (simplest for a learning project), or
  percent-encode it (`%40` for `@`) if keeping it.
- **Transaction-mode pooler (port `6543`) doesn't work for migrations**:
  it doesn't support the session-level features (advisory locks) Prisma
  Migrate needs, so `prisma migrate dev` just hangs indefinitely rather
  than erroring clearly. Fix: use the **Session pooler** (same host,
  port `5432`) for migrations. Transaction mode is fine for the app's
  normal query traffic later, just not for `migrate`.
- **A real secret leaked into this chat twice** — once via the
  environment-notification hook echoing `.env`'s contents, once via an
  unmasked `grep` while debugging. Lesson for the future: always mask
  credential values before printing them (e.g.
  `sed -E 's#(:)[^:@]+(@)#\1***\2#'`), and rotate any secret that ends up
  in a chat transcript, since transcripts should be treated as exposed.
  Password was rotated after this.

### Step 4 — Run the initial migration (real breaking-change detour)
`npx prisma migrate dev --name init` failed outright at first with
`P1012`: **Prisma 7 removed `datasource.url` from `schema.prisma`** —
connection config now lives in a separate `prisma.config.ts` file, loaded
via `dotenv` and passed through `defineConfig()`. This is exactly the
kind of breaking change `AGENTS.md` warns about — the installed CLI
(`prisma@7.9.1`) is newer than the plan (written against Prisma 5/6's
API). Fixed by: installing `dotenv` as a dev dependency, removing the
`url` line from the `datasource` block, and adding `prisma.config.ts`
that reads `DATABASE_URL` from `process.env` (mirroring what `prisma
init` itself now generates for npm-based projects). Also installed `pg`
directly, which Prisma 7's client will need later (Step 6) since driver-
based database access replaced the old built-in connector for some
providers. After the connection-string detours above, migration applied
successfully — `prisma/migrations/20260816140212_init/` created.

### Step 5 — Verify tables were created
Ran `npx prisma studio`, confirmed all six tables (`User`, `Quiz`,
`Question`, `Option`, `Attempt`, `AttemptAnswer`) appear in the sidebar,
backed by the real Supabase DB — visual proof the migration didn't just
report success but actually created the schema.

### Step 6 — Prisma client singleton (another Prisma 7 detour)
Installed `@prisma/adapter-pg` and wrote `src/lib/prisma.ts` using the
driver-adapter pattern (see chat for why). Hit one more snag: TypeScript
reported `Module '"@prisma/client"' has no exported member 'PrismaClient'`
— turned out the client had never actually been generated into
`node_modules/@prisma/client` (it re-exports from `.prisma/client`, which
didn't exist yet). Normally `prisma migrate dev` auto-runs `prisma
generate` after migrating, but that apparently didn't happen here (likely
due to the earlier connection-string retries interrupting the flow). Fixed
with an explicit `npx prisma generate`. Lesson: after any Prisma schema
or migration change, if types look stale/missing, `prisma generate` is
the first thing to try before assuming the code itself is wrong.

---

## Task 3: Password hashing utility

Followed TDD: wrote `src/lib/password.test.ts` first, confirmed it failed
for the right reason (`Cannot find module './password'` — one detour: the
file was initially saved empty, re-pasting fixed it), then implemented
`src/lib/password.ts` using `bcrypt.hash`/`bcrypt.compare`. All 3 tests
passed on the first real run. **Why bcrypt's two-function API, not a
simple hash-and-compare**: `bcrypt.hash` generates a random salt per call
and embeds it in the output, so identical passwords produce different
hashes — `bcrypt.compare` extracts that embedded salt to redo the
computation correctly, which a naive `hash(input) === storedHash` check
couldn't do. `SALT_ROUNDS = 10` is bcrypt's standard default cost factor:
expensive enough to resist brute-forcing, cheap enough not to slow down
real logins noticeably.

---

## Task 4: Signup logic + API route

TDD again: `src/app/api/signup/route.test.ts` mocks `@/lib/prisma`
entirely (via `vi.mock`), so tests run instantly against fake DB
responses instead of the real Supabase DB, and can force scenarios like
"duplicate email" without needing matching real rows. Implemented
`src/app/api/signup/route.ts` as a Next.js App Router route handler — a
plain `export async function POST(request: Request)` returning a
`Response`, no Express-style `req`/`res`. Used zod's `safeParse` (returns
a result object) instead of `parse` (throws) so invalid input becomes a
normal `400` rather than an uncaught exception. Deliberately checks for
a duplicate email *before* hashing the password, since hashing is the
expensive step and shouldn't be paid for a request about to be rejected
anyway. All 3 tests passed on the first real run — no detours this time.

---

## Task 5: Credential verification + NextAuth configuration

Confirmed installed `next-auth@4.24.15` matches the plan's pinned `^4`
before writing v4-specific code, given how many other libraries in this
stack turned out to have breaking changes vs. the plan's assumptions —
no surprises this time. TDD flow for `verifyCredentials` (mocks both
`prisma` *and* `password.ts`, since this function is meant to be thin
orchestration, not re-testing bcrypt/DB logic already covered elsewhere).
**Deliberate security choice**: `verifyCredentials` returns `null` for
both "no such user" and "wrong password" — never distinguishing which,
so an attacker can't enumerate valid emails by comparing error responses.
Added `src/types/next-auth.d.ts` (TypeScript "module augmentation" —
merges our `id`/`role` fields into NextAuth's built-in `Session`/`User`/
`JWT` interfaces instead of replacing them, so `session.user.role` is
type-checked everywhere in the app). `authOptions` in `src/lib/auth.ts`:
`authorize()` is where NextAuth calls into our `verifyCredentials`; the
`jwt` callback copies `id`/`role` onto the token at login (the token is
what's actually encrypted into the session cookie), and the separate
`session` callback copies those same fields onto `session.user` on every
session read — two callbacks because NextAuth keeps the JWT and the
session object as separate data structures, and `session` never sees the
original user object directly. The `[...nextauth]` catch-all route folder
handles every NextAuth sub-path (`/signin`, `/callback/credentials`,
`/session`, etc.) through one exported handler. Full suite: 10/10 passing
across all 4 test files — no detours this task.

---

## Task 6: Login and signup pages

UI-only task, verified manually rather than via unit tests (no pure logic
here beyond what Tasks 3–5 already cover). Signup page (`'use client'`,
required for `useState`/form interactivity) calls our own `/api/signup`
route via `fetch` — client code never touches Prisma or password hashing
directly, that stays server-side. Login page calls `signIn('credentials',
{ redirect: false })` so we can show the error inline ourselves instead
of NextAuth doing a full-page redirect to a generic error page. Wrapped
the app in `<SessionProvider>` (via a small `providers.tsx` client
component) inside `layout.tsx`, since `useSession`/`signIn`/`signOut`
rely on React Context that must wrap the whole app near the root. Minor
version-drift note (not a break, just different from the plan's
assumption): the scaffolded `layout.tsx` used Next.js 16's typed-routes
`LayoutProps<"/">` instead of a plain `{ children: React.ReactNode }`
prop type — didn't need to change it, just wrapped `{children}` as-is.
Manually verified the full signup → login → wrong-password flow in the
browser against the real Supabase DB — all 5 checks passed on the first
try, no detours.

---

## Task 7: Role-based route protection middleware

TDD for `isAuthorizedForPath` — deliberately a *pure* function
(`(path, role) → boolean`, no request/cookies/NextAuth involved), same
separation-of-concerns pattern as `verifyCredentials` being separate from
`authOptions`: decide the rule in something trivially unit-testable, then
have a thin framework-specific wrapper (`src/middleware.ts`) plug it in.
5/5 tests passed first try. The rule itself is deliberately coarse
(public / admin-only / any-logged-in-user) per the spec's stated scope of
role-based, not fine-grained, authorization; `pathname.startsWith('/admin')`
covers every nested admin path without listing each one. Middleware uses
`getToken` to read+verify the JWT straight from request cookies (no full
NextAuth session round-trip needed) and runs `isAuthorizedForPath` before
Next.js does any page/404 resolution — confirmed manually: logged-out
`/quizzes` redirects to `/login` before any 404; a `USER` role is blocked
from `/admin/quizzes`; promoting that user to `ADMIN` in Prisma Studio had
no effect until logging out and back in (the JWT is only re-issued at
login, so a live role change doesn't retroactively apply to an existing
session) — after re-login, `/admin/quizzes` was no longer redirected.
Full suite: 15/15 passing across 5 files.

**Project Foundation plan is now fully complete.** Next up: write and
execute the MCQ Core plan.

---

## Home Placeholder (2026-10-18)

Bounded change (no plan doc): short in-chat design approved, decision
locked in `SPEC.md` "Home & Pages" first (`920e695`), then code
(`dfdecd6`). Visual direction via the frontend-design skill, kept
deliberately basic.

- **Site title** — `metadata` in the root `layout.tsx` is the default
  `<title>`/description for every page that doesn't set its own; App
  Router generates `<head>` from it, so you never hand-write `<title>`.
- **Server page + tiny client island** — `/` is an `async` server
  component calling `getCurrentUser()`, so the right links are in the
  first HTML (no "Log in" flash a client-side `useSession()` would cause).
  Logging out needs a browser click handler, so it lives in a separate
  `'use client'` `SignOutButton` calling `signOut({ callbackUrl: '/' })`
  — same split as `StartQuizButton`/`DeleteQuizButton`. This is the
  app's first logout entry point. Hiding "Manage quizzes" for non-admins
  is UX only; the middleware is still the real guard.
- **`next/font` per page** — `Bricolage_Grotesque` is imported in
  `page.tsx`, not `layout.tsx`, so only Home gets it; fonts are
  downloaded at build time and self-hosted (no runtime Google request).
- **CSS module + custom properties** — `page.module.css` class names are
  hashed per file, so Home styles can't leak into other pages. Color
  tokens are declared once on `.page` and redefined under
  `prefers-color-scheme: dark`, so dark mode is a value swap, not
  duplicated rules. `.link` resets `<button>` defaults (`font: inherit`,
  `border: 0`, `background: none`) so "Log out" matches the `<a>` links.
- **Lint caught `<a>` vs `<Link>`** — `@next/next/no-html-link-for-pages`
  rejected `<a href="/quizzes">`; switched to `next/link`. `<Link>` does
  client-side navigation; dynamic pages aren't kept in the client router
  cache by default, so session-dependent links still render fresh.
  Another case where `eslint` found what `vitest`/`tsc` didn't.
- **Verification** — `tsc`, `eslint` (changed files) and `vitest`
  (91/91) clean. Logged-out / `USER` / `ADMIN` views checked by `curl`
  with real NextAuth sessions (CSRF token → credentials callback →
  cookie jar); logout click verified in the browser. Discovered
  `quiztest.manual@example.com` is actually `ADMIN`; created throwaway
  `USER` `home.user.1792312378@example.com` / `TestPass123!` for the
  user view.

## Quizzes page visuals + shared tokens (2026-10-19 → 2026-10-31)

Design locked in `SPEC.md` (`b9f16a0`), code in `2ded98f`.

- **Tokens moved up to `:root`** — Home originally declared its colors
  on `.page`. A second page needing the same palette is the signal to
  hoist them into `globals.css` (and the font into `layout.tsx` as
  `--font-sans`), so every CSS module just reads `var(--ink)` etc.
  instead of each page redefining them.
- **Status as an answer bubble** — ○ / ◐ / ● reuses the MCQ metaphor;
  the bubble has `role="img"` + `aria-label` so the status isn't
  colour-only for screen readers.
- **`className` prop on `StartQuizButton`** — lets the server page
  choose primary vs secondary styling without the client component
  knowing about page styles. Added `type="button"` too (a bare
  `<button>` defaults to `type="submit"`).

## Shared site header (2026-10-31)

Bounded change: in-chat design, locked in `SPEC.md` (`5044510`), code
in `7f03983`.

- **Header lives in `layout.tsx`** — the root layout wraps every page,
  so one `<SiteHeader />` there closes most navigation gaps at once
  (see `docs/NAVIGATION.md`). It's an `async` server component calling
  `getCurrentUser()`, same reason as Home: correct links in the first
  HTML, no logged-out flash. `SignOutButton` is reused as the client
  island inside it.
- **Layouts persist across client navigation** — App Router doesn't
  re-render a layout when you `router.push()` between pages under it;
  only the page segment changes. So after `signIn(..., { redirect:
  false })` the header would still say "Log in". `router.refresh()`
  re-requests the server components for the current route (layout
  included) without a full reload or losing client state. Logout
  didn't need this: `signOut({ callbackUrl })` does a full page load.
- **Removing duplicates** — once the header has Log out / Admin /
  Sign up, the same links on Home and the wordmark on `/quizzes` were
  redundant; Home keeps only its single primary call to action.
- **Verification** — `tsc`, `eslint`, `vitest` (91/91) clean. Header
  per role checked via `curl` with real sessions (logged out, `USER`,
  `ADMIN`; `USER` still gets `307` on `/admin/quizzes`). Then headless
  Chromium (Python Playwright) filled the real login form and confirmed
  the header switched to "Quizzes Admin Log out" *without* a reload —
  i.e. `router.refresh()` works — and back to "Log in Sign up" after
  clicking Log out, in light and dark mode; no horizontal overflow at
  360px width.

## Post-login return to the requested page (2026-10-31)

Design in `SPEC.md` (`4536cbc`), code in `be5d37a`.

- **Carry the destination in the URL** — the middleware already knows
  the blocked path, so it appends `?callbackUrl=<path+query>` to the
  `/login` redirect. URL state survives the round trip without cookies
  or storage.
- **Read it in the event handler** — per Next 16's docs, reading
  `new URLSearchParams(window.location.search)` inside a callback avoids
  `useSearchParams()`, which would need a `<Suspense>` boundary for a
  prerendered client page. The value is only needed at submit time.
- **Open-redirect guard (TDD)** — anyone can craft
  `/login?callbackUrl=https://evil.example`, so the value is untrusted
  input. `safeCallbackUrl()` allows only paths starting with `/`, and
  rejects `//host` and `/\host` (browsers treat both as another host).
  Tests written first (failed on missing module), then the function;
  94/94 passing.
- **Verification** — `curl` showed the `307` to
  `/login?callbackUrl=%2Fquizzes%2F…%3Fx%3D1`. Headless Chromium logged
  in from a blocked leaderboard URL and landed back on it; `https://`
  and `//` callbacks and a bare `/login` all landed on `/`.

## QuizTakeForm: timer bug + `set-state-in-effect` lint (2026-10-31)

Design in `SPEC.md` (`4bc53b5`), code in `1e51cf2`.

- **The hidden timer bug** — `submit` was a `useMemo` depending on
  `answers`, and the countdown effect depended on `submit`. Each answer
  click → new `submit` → effect cleanup cleared the pending 1s timeout
  → a fresh 1s wait. Fast clickers got a slower clock. Lint only
  pointed at the symptom (`submit()` setting state inside the effect).
- **Deadline, not ticks** — store `deadline = Date.now() + remaining`
  once (lazy `useState`), and let an interval *derive* `secondsLeft`
  from the clock. Counting ticks drifts and can be paused; a deadline
  can't. Setting state inside an interval *callback* is fine — the lint
  rule targets synchronous setState in the effect body.
- **`useEffectEvent` (React 19.2)** — lets the interval call the
  *latest* `submit` without listing it as a dependency, so the interval
  is created once and never restarted.
- **Effect-free `localStorage` cache** — the old pair of effects ran in
  the same commit: "load" only *scheduled* `setAnswers(cached)`, then
  "save" immediately wrote `{}` over the cache. Now answers are read in
  a lazy `useState` initializer and written in the click handler — the
  event that caused the change.
- **Hydration gate** — a lazy initializer reading `localStorage` would
  give the server (no storage) different HTML than the client.
  `useSyncExternalStore(subscribe, () => true, () => false)` returns
  `false` during SSR/hydration and `true` after, with no effect, so a
  "Loading…" shell renders first and the real form mounts client-only.
- **Verification** — `eslint` 0 errors on the file (was 2), `tsc`,
  `vitest` 94/94. Headless Chromium with Playwright's fake clock
  (`page.clock`): 20 clicks across 10 simulated seconds → exactly
  300s → 290s; reload kept all 11 checked answers; fast-forwarding past
  5 minutes auto-submitted and landed on the result page; no console
  errors or hydration warnings.

## Test mocks: `as any` → `as never` (2026-10-31)

- Mocks like `mockResolvedValue({ id: 'quiz-1' } as any)` return a
  partial Prisma row. `Partial<Quiz>` doesn't fit — the mock expects the
  full return type (often with joined relations). `as never` is the
  narrow escape hatch: `never` is assignable to every type, so it
  compiles, but unlike `any` it can't leak loose typing into the rest
  of the test (you can't call methods on it or pass it around untyped).
- Where a real type was easy, used it instead: the `$transaction` mock
  is typed via `typeof prismaMock`, and quiz-JSON "missing field" inputs
  are `Record<string, unknown>` (matches `validateQuizJson(input:
  unknown)`), so `delete` is allowed without a cast.
- Result: `eslint .` clean repo-wide; `tsc` and `vitest` 94/94.

## GitHub remote: `origin` → alok2say/QuizApp (2026-10-31)

- **Remote = a named URL.** `git remote add origin <url>` only saves
  the URL under the name `origin`; nothing is sent. Running `push`
  before `remote add` fails with "'origin' does not appear to be a git
  repository", because the name doesn't exist yet.
- **Create the GitHub repo empty.** With no README, license or
  .gitignore on GitHub, the first push needs no merge.
- **`git push -u origin main`** uploads `main` and sets it to track
  `origin/main` (`-u`), so later a plain `git push` or `git pull` works.
- **403 "denied to alranjan_expedia"** means GitHub was reached but git
  signed in as the wrong account. `gh auth login` (as alok2say) plus
  `gh auth setup-git` make git use gh's login, and gh sends the
  *active* account for every github.com repo. Use `gh auth switch` to go
  between personal and Expedia work.
- **Pre-push check:** `git check-ignore .env .env.local` confirmed no
  secrets were pushed.
- Verified: `git status -sb` shows `## main...origin/main`.

## Per-repo GitHub identity: no more `gh auth switch` (2026-10-31)

- **Commit email ≠ login.** `user.email` only labels commits, and
  GitHub links a commit to whichever account owns that email.
  `git config --local user.email 2642816+alok2say@users.noreply.github.com`
  overrides the global Expedia email for this repo only. The noreply
  format `<id>+<login>@users.noreply.github.com` always links to the
  account and hides your real email. Commits already pushed keep the old
  email.
- **Credential helpers stack:** git reads system, then global, then
  local config, and an empty value (`""`) clears the list so far. So in
  `.git/config`:
  1. `credential.https://github.com.helper ""` drops the global
     `gh auth git-credential`, which sends the *active* account.
  2. `--add` a helper that answers only `get` with
     `username=alok2say` and `gh auth token --user alok2say`. Without
     `--add`, git would replace the empty value instead of adding after it.
- **Check without pushing:** `git credential fill` showed
  `username=alok2say`, and `git push --dry-run` with `alranjan_expedia`
  active gave no 403.
- Caveat: this relies on alok2say staying logged in to `gh`.

## Take, result, leaderboard visuals (2026-10-31)

Design in `SPEC.md` (`076ce04`), queries `964bb09` + `16c7aa0`, pages
`c8675a7`. Visual direction via the frontend-design skill: one paper
exam — filled in, marked, posted on the board.

- **Restyle real inputs, don't replace them** — each option is still a
  native radio/checkbox inside a `<label>`, made invisible (not
  `display: none`, which would drop it from keyboard focus) and
  followed by a `.mark` span. `input:checked + .mark` and
  `input:focus-visible + .mark` style the mark from the input's state,
  so keyboard, screen readers, and form semantics keep working with no
  extra JS.
- **Never colour alone** — right/wrong is also a shape (✓, ✗, ring),
  with screen-reader text ("your answer, correct answer") in an
  `srOnly` span, since the glyphs are `aria-hidden`.
- **Shared CSS modules** — `answerSheet.module.css` (marks, question
  rows) and `controls.module.css` (buttons) are imported by several
  pages; `/quizzes` dropped its own copy of the button styles. CSS
  modules compose by importing the same module in each component.
- **Data before pixels** — designing the result page exposed three
  data gaps, each fixed test-first in the query rather than worked
  around in the UI: `retakePolicy`/`quizId` (to offer Retake),
  question `type` (round vs square marks), and sorting by `order`
  (otherwise "question 2" on the result page might be question 1 on
  the take page — same mocked-`orderBy` lesson as Admin Authoring).
- **`overflow-x: hidden` breaks sticky** — the timer bar's
  `position: sticky` did nothing. Cause: `html, body { overflow-x:
  hidden }` from the scaffold turns them into scroll containers, and a
  sticky element sticks to its nearest scroll container. `overflow-x:
  clip` hides overflow without creating one. Only found by scrolling a
  screenshot — no test or lint would catch it.
- **Verification** — `vitest` 96/96, `tsc`, `eslint .` clean.
  Playwright screenshots: take (answered + focus ring, sub-60s red
  timer via fake clock, scrolled sticky bar), result (light/dark,
  mobile), leaderboard (own row, other user's "not taken yet" view,
  mobile); no horizontal overflow at 360px; no console errors.

## Login, signup, admin visuals (2026-10-31)

Design in `SPEC.md` (`136f76c`), code in `6307535` + `a162757`.

- **Server page + client form** — `/login` and `/signup` were whole
  `'use client'` pages. To render links and a notice from the URL
  (`callbackUrl`, `created=1`) without `useSearchParams` + `<Suspense>`,
  each `page.tsx` is now a server component that awaits `searchParams`,
  sanitizes `callbackUrl`, and passes plain props to `LoginForm` /
  `SignupForm`. Same split as the rest of the app.
- **`readErrorBody` (TDD)** — `res.json()` throws on an empty or HTML
  body, which is exactly what an unhandled server error returns. One
  helper returns the parsed body or `null`, and each caller supplies a
  status-based fallback message. Tested with real `Response` objects.
- **Errors that tell you what to do** — validation errors are things
  the admin can fix, so they get "Fix these before saving:"; a server
  failure isn't, so it's a separate message that says the edits are
  safe.
- **Write-in fields** — inputs have only a bottom border (like an exam
  sheet's name line); `border-radius: 0` and `background: none` stop
  browser defaults from rounding/filling them, and focus switches the
  line to `--answer` instead of an outline.
- **Test-tool artifact, not a bug** — a hydration warning showed up
  only in runs that took screenshots: Playwright injects
  `caret-color: transparent` into inputs to hide the cursor, and here
  it landed before React hydrated. The same pages loaded without
  screenshots had no warning.
- **Commit slip** — a staged `git mv` (controls module) rode along in
  the helper commit while its import updates landed in the next one,
  so `6307535` alone doesn't build. Lesson: `git status` before every
  commit, or commit with explicit paths only after checking nothing
  else is staged.
- **Verification** — `vitest` 101/101, `tsc`, `eslint .` clean; full
  signup → login → original page flow in Chromium (created
  `design.check.1793436504@example.com` / `TestPass123!` in the dev DB).

## Active link in the header (2026-10-31)

- **Why a client component** — the header is a server component, but
  the layout doesn't re-render on client navigation, so it can't know
  the current URL after a `<Link>` click. `usePathname()` in a tiny
  `'use client'` `NavLink` re-renders on every navigation; the server
  header just renders `NavLink`s.
- **`aria-current="page"`** — the accessible way to mark the current
  link; screen readers announce it, and the CSS styles off the same
  attribute (`.link[aria-current='page']`) so visuals and semantics
  can't drift apart.
- **Prefix matching (TDD)** — `isActivePath` matches the exact path or
  `href + '/'…`, so `/quizzes/x/take/y` lights "Quizzes" but a sibling
  like `/quizzes-archive` wouldn't.
- **Verification** — `vitest` 103/103, `tsc`, `eslint .`; Chromium
  checked the active link on `/`, login, signup, `/quizzes` (via
  client-side click), leaderboard, admin list (client click) and new.

## PDF library (2026-10-31)

Brainstormed → `SPEC.md` "PDF Library" (`6ff238b`) → plan
`docs/superpowers/plans/2026-10-31-pdf-library.md` (`0bc1782`) → 3 tasks
on branch `feature/pdf-library`.

- **Catalog as a seam (TDD)** — pages only call `getDocuments()` /
  `getDocument(slug)`. Today they read a typed array; when PDFs come
  from a server, only those two functions change. Tests also check that
  every catalog file exists on disk, so a typo fails `vitest` instead
  of showing a blank viewer.
- **`ssr: false` lives in a client file** — the viewer uses WebAssembly
  and browser APIs, so it must never render on the server. Next 16 only
  allows `dynamic(..., { ssr: false })` inside a `'use client'` module,
  so `PdfViewerLoader.tsx` exists just to hold it; the page stays a
  server component.
- **Self-hosted wasm via `postinstall`** — the library fetches
  `pdfium.wasm` (7.7 MB) from jsdelivr by default. A tiny script copies
  it from `node_modules` into `public/pdfium/` on every `npm install`
  (git-ignored, so it always matches the installed version).
- **Root-relative URLs don't work in `blob:` workers** — with
  `wasmUrl: '/pdfium/pdfium.wasm'` the viewer hung on "Loading
  document…" and no wasm request ever appeared. The engine's workers are
  created from `blob:` URLs, which have no path to resolve `/...`
  against. Building an absolute URL from `location.origin` fixed it.
  Found by tracing worker and request events in Playwright, not by
  guessing.
- **Percentage height needs a definite parent** — `height: 100%` on the
  viewer collapsed to ~20px because its frame only had `flex: 1` +
  `min-height`, which isn't a definite height. `position: relative` on
  the frame + `position: absolute; inset: 0` on the viewer gives it one.
- **`key={doc.slug}`** — re-mounts the viewer when moving between
  documents, so it never keeps showing the previous PDF.
- **Registry detour** — `npm install` hit `E401` from the Artifactory
  registry in `~/.npmrc` (expired credentials); the user chose to
  install these two packages from the public npm registry. npm wrote
  `^2.1.0`, pinned back to exact `2.1.0`.
- **Verification** — `vitest` 108/108, `tsc`, `eslint .`; Chromium:
  render, search, zoom, paging, client-nav switching, 404s, no CDN
  requests, dark, 360px.

<!-- Continue appending one entry per step as we go. -->
