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

<!-- Continue appending one entry per step as we go. -->
