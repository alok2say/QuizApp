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

<!-- Continue appending one entry per step as we go. -->
