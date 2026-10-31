# Design System Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure DemoQuizApp into routes → feature Views → `src/ui/` components → tokens, so a future redesign is made in tokens and `ui/` instead of every page, with no visible change today.

**Architecture:** Every visual value moves into `src/styles/tokens.css`. Repeated page patterns (page shell, titles, buttons, links, fields, ruled lists, notices) become presentational components in `src/ui/`. Each route in `src/app/` keeps only auth, data loading and redirects, and renders one View from `src/features/<area>/`. Two Vitest guards and an ESLint rule keep the layers clean. A Playwright snapshot script proves that nothing looks different.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2, CSS Modules, Vitest 4 (node env, `react-dom/server` `renderToStaticMarkup` for component tests; CSS-module class names resolve in tests, checked in a spike), ESLint 9 flat config, Python Playwright 1.62 + Pillow 12 (both installed for `python3`).

**Spec:** `SPEC.md` → "Design System Structure (designed 2026-11-01)" (commit `8f88a01`).

## Global Constraints

- **No visible change.** Exact CSS values are preserved through tokens. The only allowed deltas are listed in Task 1's `EXPECTED_DIFFS` note: the bubble `margin-top` (0.2rem → 0.25rem) and the line-height of the Home section `h2` (normal → 1.3).
- **Token names, verbatim from the spec:**
  - colors: `--color-text`, `--color-bg`, `--color-text-muted`, `--color-accent`, `--color-on-accent`, `--color-border`, `--color-success`, `--color-danger`. The old names (`--ink`, `--paper`, `--muted`, `--answer`, `--on-answer`, `--rule`, `--right`, `--mark`) are removed, not aliased.
  - spacing: `--space-unit: 0.25rem`; steps `--space-N: calc(var(--space-unit) * N)` for N ∈ {0-5 (=0.5), 1, 2, 2-5 (=2.5), 3, 3-5 (=3.5), 4, 5, 6, 7, 8, 10, 12, 14, 16, 18}. Fractional steps use a dash, since `.` is not valid in a custom property name.
- **What `src/app/**` may hold:** routes only. No `*.module.css` imports anywhere in `src/app/**`.
- **What `src/ui/**` may hold:** no `@/lib/quiz`, `@/lib/session`, `fetch`, `next-auth` or `useRouter`. Only `NavLink` may use `usePathname`.
- **Copy:** every user-facing string stays byte-identical.
- **Commits:** each one ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **The dev server** is already running on :3000 (background task `ba3s9id2a`). Don't start another one.

## Review Focus

1. **Client components moved into `features/`.** Check that they still carry `'use client'`, and that server Views don't import client-only hooks. A wrong move either breaks `next build` or fails only at runtime. `next build` runs in each feature task.
2. **The `ui/index.ts` barrel re-exporting a `'use client'` module (`NavLink`).** Server components importing the barrel must still render. `next build` covers this. Task 7 also adds a test that imports the barrel from a node test.
3. **Interactive states are not in the screenshots:** focus rings, `:hover`, `[aria-current]`, disabled, and `:checked` on answer marks. The Task 14 snapshot script adds a "focused" capture: Tab to the first control on `/login`, and check an option on the take page.
4. **Dark mode:** each token must have its dark value. A Task 2 test asserts that the dark block defines exactly the same set of color tokens as the light block.
5. **StartQuizButton's error text:** it was styled by parent selectors (`.action p[role=alert]`, `.cta p[role=alert]`, `.actions p[role=alert]`). After the move it renders `ErrorMessage size="small"` itself. Task 11 covers this with a test of `ErrorMessage` and a forced 500 check in the browser.

---

### Task 1: Visual snapshot tool + baseline

**Files:**
- Create: `scripts/visual-snapshots.py`
- Modify: `.gitignore` (add `/.snapshots/`)

**Interfaces:**
- Produces: `python3 scripts/visual-snapshots.py capture <name>` writes `.snapshots/<name>/<page>-<scheme>-<width>.png`; `python3 scripts/visual-snapshots.py compare <a> <b>` prints one line per file `<file>: <N> px differ` and exits 1 if any file differs or is missing.

- [ ] **Step 1: Write the script.**
  - **Pages:** `/`, `/login`, `/login?created=1`, `/signup`, `/library`, `/library/cardiology-chap-2`, `/design` (skipped when it returns 404), `/quizzes`, `/quizzes/$SNAP_QUIZ_ID/leaderboard`, `$SNAP_RESULT_URL`, `$SNAP_TAKE_URL`, `/admin/quizzes`, `/admin/quizzes/new`, `/admin/quizzes/$SNAP_QUIZ_ID/edit`.
  - **Matrix:** schemes `light` and `dark` via `color_scheme`; widths 1280 and 360; full page.
  - **Login:** through the real form, using `SNAP_USER_EMAIL` and `SNAP_USER_PASSWORD`, and `SNAP_ADMIN_EMAIL` and `SNAP_ADMIN_PASSWORD` for the admin pages. A page whose env var is unset is skipped and printed as skipped.
  - **Masking:** mask `pdf-reader` and the take-page timer (`[aria-label^="Time left"]`) with `mask=` so content that changes between runs doesn't create diffs. Wait for `networkidle` before each capture.
  - **Compare:** use `PIL.ImageChops.difference(...).getbbox()`, and count differing pixels with `point(lambda p: p > 0)`.
  - **No secrets:** credentials are read only from env, never written to a file.
- [ ] **Step 2: Capture the baseline from the current `HEAD`.**
  - **Setup:** pick an existing in-progress attempt for `SNAP_TAKE_URL` and a submitted attempt for `SNAP_RESULT_URL` on "Sample Quiz" (`cmuiplsqr0000zcsifjnz15md`). Look them up with a read-only Prisma query. Never start a new attempt.
  - **Run:** `python3 scripts/visual-snapshots.py capture baseline`
  - **Expected:** `.snapshots/baseline/` has 4 PNGs per available page, and skipped pages are listed.
- [ ] **Step 3: Check the comparison works.**
  - **Run:** `capture baseline2`, then `compare baseline baseline2`.
  - **Expected:** every file shows `0 px differ` and the exit code is 0. If any file differs, fix the masking or waits first: an unstable tool can't prove anything.
- [ ] **Step 4: Commit** the script and `.gitignore`.
  - `git commit -m "chore: add visual snapshot capture/compare script"`

### Task 2: Tokens + rename + guards (ratchet)

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/tokens.test.ts`
- Modify: `src/app/globals.css`, `src/app/layout.tsx` (import `@/styles/tokens.css` before `./globals.css`), and every `*.module.css` (rename the color vars only)

**Interfaces:**
- Produces:
  - all token names from the spec;
  - `PENDING_RAW_VALUES: string[]` in `tokens.test.ts`, the repo-relative CSS files not yet migrated off raw values. Every later task removes its files from this list.

- [ ] **Step 1: Write the failing tests** in `src/styles/tokens.test.ts`. They read files with `fs` and find them with `fs.globSync('src/**/*.css')`.
  - `every var() used in CSS is defined in tokens.css`
    - **What it checks:** collect `var(--x` across all CSS files, and the definitions `--x:` in `tokens.css`. Allow `--font-sans`, which next/font defines.
    - **Assertion:** `expect(undefinedVars).toEqual([])`
  - `dark mode defines the same color tokens as light`
    - **What it checks:** the `--color-*` names in the `:root` block equal those in the `prefers-color-scheme: dark` block.
  - `no raw values outside tokens.css`
    - **What it checks:** for each CSS file except `tokens.css` and the `PENDING_RAW_VALUES` files, find lines that match `/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\d(\.\d+)?(rem|em|px|vh|vw)\b/i` and don't contain `token-exempt:`.
    - **Assertion:** `expect(offenders).toEqual([])`
  - `pending files still have raw values`
    - **What it checks:** every file in `PENDING_RAW_VALUES` still has at least one match.
    - **Why:** this forces each file off the list the moment it's clean.
  - **Initial list:** `PENDING_RAW_VALUES` = all 12 current `*.module.css` files.
- [ ] **Step 2: Run the tests and watch them fail.**
  - **Run:** `npx vitest run src/styles`
  - **Expected:** FAIL. `tokens.css` doesn't exist (ENOENT), or the vars `--ink`, `--paper` and so on are undefined. `globals.css` counts as an offender because of its hex values.
- [ ] **Step 3: Create `tokens.css`, then rename the color vars.**
  - **Contents:** the spec's full token set. The colors move from `globals.css` with their exact light and dark hex values. The type, shape and layout values are exactly the ones in the spec's Tokens section.
  - **Font tokens:** `--font-body: var(--font-sans), Arial, Helvetica, sans-serif`, and `--font-mono: ui-monospace, SFMono-Regular, Menlo, monospace`.
  - **`globals.css`:** remove its token blocks and use only tokens.
  - **Rename** the 8 color vars in every CSS file:
    - `sed -i '' -e 's/var(--ink)/var(--color-text)/g' ...`
    - `--muted` must be renamed before `--mark` is touched, and `--on-answer` before `--answer`.
- [ ] **Step 4: Run the tests and watch them pass.**
  - **Run:** `npx vitest run src/styles`
  - **Expected:** PASS 4/4.
- [ ] **Step 5: Check nothing else broke.**
  - **Run:** `npm test && npm run lint && npx tsc --noEmit`, all green.
  - **Run:** `capture t2` and `compare baseline t2`, with 0 px on all files.
- [ ] **Step 6: Commit.**
  - `refactor: move visual values into tokens.css with semantic color names`

### Task 3: `ui` layout primitives — Page, PageHeader, Heading, VisuallyHidden

**Files:**
- Create: `src/ui/Page.tsx`, `Page.module.css`, `PageHeader.tsx`, `PageHeader.module.css`, `Heading.tsx`, `Heading.module.css`, `VisuallyHidden.tsx`, `VisuallyHidden.module.css`, `src/ui/index.ts`, `src/ui/layout.test.tsx`

**Interfaces:**
- **Produces:**
  - `Page({ width?: 'narrow'|'medium'|'default'|'wide' = 'default', top?: 'default'|'cover'|'hero' = 'default', children })` renders `<div class=page top-variant><main class=main width-variant>{children}</main></div>`.
  - `PageHeader({ title: ReactNode, intro?: ReactNode, size?: 'display'|'page'|'cover'|'sub' = 'page', action?: ReactNode })` renders an `h1` with the size class, an optional `p` intro whose size and margin follow `size`, and `action` beside the title in a wrapping flex row (the admin layout).
  - `Heading({ as?: 'h2'|'h3' = 'h2', id?, children })`: the 1.25rem / 600 / 1.3 row title.
  - `VisuallyHidden({ as?: 'span'|'thead' = 'span', children })`. The `1px` sizes carry `token-exempt: visually-hidden pattern`.
- **Values from today's CSS:**

  | Variant | Title size | Line height | Tracking | Intro size | Intro margin-top | Page width | Top padding |
  |---|---|---|---|---|---|---|---|
  | display | display | 1 | -0.03em | lead-lg | space-4 | medium | hero |
  | page | page | 1.05 | -0.03em | lead | space-3 | default | default |
  | cover | cover | 1.05 | -0.03em | body | space-2 | narrow | cover |
  | sub | sub | 1.15 | -0.02em | — | — | default | default |

  All titles use weight 700. The width and top columns are the `Page` props each View passes; `PageHeader` itself doesn't set them.

- [ ] **Step 1: Write the failing tests** in `src/ui/layout.test.tsx`, using `renderToStaticMarkup`.
  - `Page wraps children in main with the width class`
    - **Assertion:** HTML matches `<div class="… page …"><main class="… main … wide …">x</main></div>`, using the `styles.wide` imported from `Page.module.css`.
  - `PageHeader renders h1 then intro`
    - **Assertion:** `<h1` comes before the intro text. With no `intro`, there is no `<p`.
  - `PageHeader renders action next to the title`
    - **Assertion:** the action markup appears inside the header row.
  - `Heading defaults to h2`
    - **Assertion:** the HTML starts with `<h2`, and `as="h3"` gives `<h3`.
  - `VisuallyHidden can render a thead`
    - **Assertion:** the HTML starts with `<thead`.
- [ ] **Step 2: Watch them fail.**
  - **Run:** `npx vitest run src/ui`
  - **Expected:** FAIL, cannot resolve `./Page`.
- [ ] **Step 3: Implement the four components** and `index.ts`, which re-exports them. The CSS uses only tokens.
- [ ] **Step 4: Watch them pass.**
  - **Run:** `npx vitest run src/ui` and `npx vitest run src/styles`.
  - **Expected:** both PASS. The new `ui` CSS has no raw values, apart from the exempt lines.
- [ ] **Step 5: Commit.**
  - `feat(ui): page shell, page header, heading, visually-hidden`

### Task 4: `ui` actions — Button, ButtonLink, TextLink, TextButton

**Files:**
- Create: `src/ui/Button.tsx`, `Button.module.css`, `TextLink.tsx`, `TextLink.module.css`, `src/ui/actions.test.tsx`
- Modify: `src/ui/index.ts`

**Interfaces:**
- **Produces:**
  - `Button({ variant?: 'primary'|'secondary' = 'primary', type?: 'button'|'submit' = 'button', disabled?, onClick?, children })`
  - `ButtonLink({ variant?, href, children })`, built on `next/link`. Today's `controls.primary` and `controls.secondary` values; Home's `.primary` folds into this, with identical box size.
  - `TextLink({ href, tone?: 'default'|'muted' = 'default', children })`, underlined, offset `.2em`.
  - `TextButton({ tone?: 'default'|'danger' = 'default', onClick?, disabled?, children })`, styled like a text link, `type="button"`. These are admin `.textLink` and `.danger`.
- **Focus ring:** every one of these uses the focus-ring tokens on `:focus-visible`.

- [ ] **Step 1: Write the failing tests.**
  - `Button defaults to type=button primary`
    - **Assertion:** `type="button"` and `styles.primary` are present.
  - `Button submit + disabled`
    - **Assertion:** `type="submit"` and `disabled=""` are present.
  - `ButtonLink renders an anchor with href and variant class`
  - `TextButton danger has the danger class and type=button`
  - `TextLink muted tone`
- [ ] **Step 2: Watch them fail.**
  - **Run:** `npx vitest run src/ui/actions.test.tsx`
  - **Expected:** FAIL, unresolved import.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
  - **Run:** `npx vitest run src/ui src/styles`
  - **Expected:** PASS.
- [ ] **Step 5: Commit.**
  - `feat(ui): buttons and text links`

### Task 5: `ui` forms and messages — Form, Field, Input, ErrorMessage, Notice

**Files:**
- Create: `src/ui/Form.tsx`, `Form.module.css`, `Notice.tsx`, `Notice.module.css`, `src/ui/forms.test.tsx`
- Modify: `src/ui/index.ts`

**Interfaces:**
- **Produces:**
  - `Form({ onSubmit, children })`: a column with gap `space-6`, and a direct-child `button` gets `align-self: flex-start`.
  - `Field({ label, help?, children })`: a `<label>` holding the label text, then children, then the optional help `<span>`. This is today's markup.
  - `Input(props: InputHTMLAttributes<HTMLInputElement>)`: the write-in line style. It forwards every prop.
  - `ErrorMessage({ size?: 'body'|'small' = 'body', children })` renders `<p role="alert">` in `--color-danger`. The `small` size is `--text-sm` with margin-top `space-2`, as in today's StartQuizButton error.
  - `Notice({ tone: 'success'|'accent'|'danger', role?, children })`: a 4px left bar in that color.
- **Values per tone:**

  | Tone | Used by | Left padding | Margin-top |
  |---|---|---|---|
  | success | auth "Account created" | space-3 | space-6 |
  | accent | leaderboard own rank | space-3-5 | space-6 |
  | danger | editor errors | space-3 | space-4 |

  The danger tone also sets `p { font-weight:600; color: danger }` and the nested `ul` padding.

- [ ] **Step 1: Write the failing tests.**
  - `Field wraps input inside label with help after`
  - `Input forwards type, required, minLength and autoComplete`
  - `ErrorMessage has role=alert`
  - `ErrorMessage small has the small class`
  - `Notice tone class and passes role`
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
  - **Run:** `npx vitest run src/ui src/styles`
  - **Expected:** PASS.
- [ ] **Step 5: Commit.**
  - `feat(ui): form fields, error message, notice`

### Task 6: `ui` content — List, ListRow, Description, Meta, EmptyState, Actions

**Files:**
- Create: `src/ui/List.tsx`, `List.module.css`, `Text.tsx` (Description, Meta), `Text.module.css`, `EmptyState.tsx`, `EmptyState.module.css`, `Actions.tsx`, `Actions.module.css`, `src/ui/content.test.tsx`
- Modify: `src/ui/index.ts`

**Interfaces:**
- **Produces:**
  - `List({ as?: 'ul'|'ol' = 'ul', children })`: margin-top `space-10`, no bullets, top border.
  - `ListRow({ align?: 'start'|'baseline' = 'start', density?: 'default'|'compact' = 'default', className?, children })`
    - default density: padding `space-6`, gap `space-4 space-6`; this is the library row.
    - compact density: padding `space-5`, gap `space-2 space-6`; this is the admin row.
    - every row: bottom border, flex, wrap, space-between.
    - `className` lets a feature swap in its own layout, such as the quiz grid.
  - `Description({ children })`: `p`, margin-top `space-1`, line height 1.5, muted.
  - `Meta({ spacing?: 'tight'|'default' = 'default', children })`: `p`, flex wrap, gap `space-1 space-5`, `--text-meta`, muted, tabular-nums. Margin-top is `space-2` by default, `space-1` when tight. Nested `a` is text-colored and underlined, with focus ring.
  - `EmptyState({ children })`: `p`, margin-top `space-10`, muted.
  - `Actions({ gap?: 'tight'|'default'|'loose' = 'default', spacing?: 'default'|'loose', children })`: a wrapping, centered flex row.
    - gaps: tight `space-3` (editor), default `space-4 space-6` (result), loose `space-6` (home).
    - margin-top: `space-6` for default spacing, `space-8` for loose.
- **Home `.books` section:** it doesn't fit any of these, so it stays in `features/home` CSS.

- [ ] **Step 1: Write the failing tests.**
  - `List renders ol when asked`
  - `ListRow compact has the compact class and passes className`
  - `Meta tight`
  - `EmptyState renders a p`
  - `Actions loose gap class`
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit.**
  - `feat(ui): lists, meta text, empty state, action row`

### Task 7: `ui` navigation — TopBar, NavLink, NavButton

**Files:**
- Create: `src/ui/TopBar.tsx`, `TopBar.module.css`, `src/ui/NavLink.tsx` (moved from `src/app/NavLink.tsx`, with `'use client'`), `src/ui/nav.test.tsx`
- Modify: `src/ui/index.ts`
- Delete: `src/app/NavLink.tsx` (after Task 8 switches its import; Task 8 deletes it)

**Interfaces:**
- **Produces:**
  - `TopBar({ brand: { label: string; href: string }, navLabel: string, children })` renders `<header><div inner><Link brand/><nav aria-label=navLabel>{children}</nav></div></header>`.
  - `NavLink({ href, children })` takes no className and owns `TopBar`'s link style.
  - `NavButton({ onClick?, children })` is styled like a nav link and is `type="button"`.
- **Values:** today's `SiteHeader.module.css`.

- [ ] **Step 1: Write the failing tests.**
  - `TopBar renders brand link and labelled nav`
  - `NavLink renders href and no aria-current outside a router`
    - **Why:** `usePathname` returns null in the test, and `isActivePath` must handle null. Widen its param to `string | null` only if the test shows it's needed. Ledger that as a ruling.
  - `importing @/ui from node works`
    - **Why:** this is Review Focus item 2.
- [ ] **Step 2: Watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Watch them pass.**
- [ ] **Step 5: Commit.**
  - `feat(ui): top bar and nav links`

### Task 8: Feature `site` + `home` — header and Home page

**Files:**
- Create: `src/features/site/SiteHeader.tsx`, which takes `user` and renders `TopBar`, `NavLink` and `SignOutButton`; `src/features/site/SignOutButton.tsx`, moved and now rendering `NavButton`; `src/features/home/HomeView.tsx`; `src/features/home/HomeView.module.css`, which holds only `.books` and `.placeholder`
- Modify: `src/app/layout.tsx`, which becomes `async`: it calls `const user = await getCurrentUser()` and renders `<SiteHeader user={user} />`; `src/app/page.tsx`, which becomes a loader plus `<HomeView signedIn={!!user} />`
- Delete: `src/app/SiteHeader.tsx`, `SiteHeader.module.css`, `NavLink.tsx`, `SignOutButton.tsx`, `page.module.css`. Remove those files from `PENDING_RAW_VALUES`.

**Interfaces:**
- **Consumes:** Tasks 3–7.
- **Produces:**
  - `SiteHeader({ user: { role: 'USER'|'ADMIN' } | null })`
  - `HomeView({ signedIn: boolean })`
- **Home markup:**
  - `Page width="medium" top="hero"` holds `PageHeader size="display" title="DemoQuizApp" intro=…`, then `Actions spacing="loose" gap="loose"`, wrapped in a `nav aria-label="Main"`, holding a `ButtonLink`.
  - The Books and Events sections come after, using `Heading` and `TextLink`.

- [ ] **Step 1: Run** `npx vitest run src/styles` with the five files still in `PENDING`. Expected: PASS.
- [ ] **Step 2: Make the moves and rewrites**, then remove the deleted files from `PENDING`.
- [ ] **Step 3: Check everything.**
  - **Run:** `npm test && npm run lint && npx tsc --noEmit && npx next build > $LEDGER_DIR/build.log 2>&1; tail -20`
  - **Expected:** green.
  - **Run:** `capture t8` and `compare baseline t8`.
  - **Expected:** `/` differs only in the listed section-h2 line-height delta. Inspect the diff region by eye. All other pages show 0 px.
- [ ] **Step 4: Commit.**
  - `refactor: header and home use ui components via features/`

### Task 9: Feature `auth`

**Files:**
- Create: `src/features/auth/LoginForm.tsx`, `src/features/auth/SignupForm.tsx` (both moved, keeping `'use client'` and their logic)
- Modify: `src/app/login/page.tsx`, `src/app/signup/page.tsx` (imports only)
- Delete: `src/app/login/LoginForm.tsx`, `src/app/signup/SignupForm.tsx`, `src/app/authForm.module.css`. Remove it from `PENDING`.

**Interfaces:**
- **Consumes:** `Page width="narrow" top="cover"`, `PageHeader size="cover"`, `Notice tone="success"`, `Form`, `Field`, `Input`, `ErrorMessage`, `Button type="submit"`.
- **The cross-link paragraph** ("New here? …") becomes a `features/auth` CSS rule `.switch` (margin-top `space-8`, muted) with a `TextLink` inside.

- [ ] **Step 1: Make the moves and rewrites.**
- [ ] **Step 2: Check everything.**
  - **Run:** the full check from Task 8, then `capture t9` and `compare baseline t9`.
  - **Expected:** `/login`, `/login?created=1` and `/signup` show 0 px.
  - **Browser:** a wrong password shows the error, and signup → login shows the "Account created" notice.
- [ ] **Step 3: Commit.**
  - `refactor: auth forms use ui components`

### Task 10: Feature `library`

**Files:**
- Create: `src/features/library/LibraryListView.tsx`, `src/features/library/DocumentView.tsx`, `src/features/library/DocumentView.module.css` (`.page`, `.head`, `.frame` only, tokens)
- Modify: `src/app/library/page.tsx`, `src/app/library/[slug]/page.tsx`
- Delete: `library.module.css`, `viewer.module.css`. Remove them from `PENDING`.

**Interfaces:**
- **Produces:**
  - `LibraryListView({ documents: LibraryDocument[] })`, using the catalog's exported type.
  - `DocumentView({ doc: LibraryDocument })`, which keeps `<PdfReader key={doc.slug} …>`.
- **The frame's intrinsic size:** `min-height: 32rem` carries `/* token-exempt: viewer minimum */`.

- [ ] **Step 1: Make the moves and rewrites.**
- [ ] **Step 2: Check everything.**
  - **Run:** the full check, then `capture t10` and `compare baseline t10`.
  - **Expected:** 0 px, with `pdf-reader` masked.
  - **Browser:** a PDF renders.
- [ ] **Step 3: Commit.**
  - `refactor: library views use ui components`

### Task 11: Feature `quizzes` — list + StartQuizButton

**Files:**
- Create: `src/features/quizzes/QuizListView.tsx`, `QuizRow.module.css` (grid row, bubble, `.inProgress`, `.done`, mobile media query), `src/features/quizzes/StartQuizButton.tsx` (moved)
- Modify: `src/app/quizzes/page.tsx`
- Delete: `src/app/quizzes/page.module.css`, `src/app/quizzes/StartQuizButton.tsx`. Remove them from `PENDING`.

**Interfaces:**
- **Produces:**
  - `QuizListView({ quizzes: QuizWithStatus[] })`. Use the return type of `getQuizzesWithStatus`, `Awaited<ReturnType<…>>[number]`, if it isn't exported.
  - `StartQuizButton({ quizId, label, variant?: 'primary'|'secondary' = 'primary' })`. It renders `Button` and `ErrorMessage size="small"`, and drops its `className` prop. Callers pass `variant` instead.
- **The quiz-row error width:** today's `max-width: 14rem` on the error moves to a `QuizRow.module.css` rule with `token-exempt: error wraps under button`.
- **Media query:** `@media (max-width: 34rem)` can't take a var. Add an exemption on that line: `token-exempt: media queries can't use custom properties`.

- [ ] **Step 1: Make the moves and rewrites.**
- [ ] **Step 2: Check everything.**
  - **Run:** the full check, then `capture t11` and `compare baseline t11`.
  - **Expected:** `/quizzes` differs only by the bubble 0.05rem shift. Inspect it.
  - **Browser:** intercept `/api/quizzes/*/start` with a body-less 500. The page shows the small red error under the button: Review Focus 5.
- [ ] **Step 3: Commit.**
  - `refactor: quiz list uses ui components`

### Task 12: Feature `attempt` — take, result, leaderboard

**Files:**
- Create:
  - `src/features/attempt/QuizTakeForm.tsx` (moved; all timing and caching logic unchanged)
  - `src/features/attempt/TakeView.module.css` (bar, timer, footer, progress)
  - `src/features/attempt/answerSheet.module.css` (moved, tokens)
  - `src/features/attempt/ResultView.tsx`, `ResultView.module.css` (score, summary marks, question head, points)
  - `src/features/attempt/LeaderboardView.tsx`, `LeaderboardView.module.css` (table, rank, you-row)
- Modify: the three route `page.tsx` files under `src/app/quizzes/[quizId]/`
- Delete: `answerSheet.module.css`, `take.module.css`, `result.module.css`, `leaderboard.module.css`, `QuizTakeForm.tsx` from `src/app`. Remove them from `PENDING`.

**Interfaces:**
- **Produces:**
  - `ResultView({ result: AttemptResult })`
  - `LeaderboardView({ board: Leaderboard, viewerId: string, quizId: string })`
  - Types come from `@/lib/quiz/queries`, the success branch of each function's return type.
- **Consumes:**
  - `Page`, `PageHeader size="sub"` (result title) and `size="page"` (leaderboard)
  - `Actions`, `TextLink`, `Notice tone="accent"` (own rank), `EmptyState`, `VisuallyHidden as="thead"`
  - `StartQuizButton`
- **What stays put:** the take page keeps its own full-bleed layout. It doesn't use `Page`, because the sticky bar needs the `min(var(--width-default), calc(100% - 2 * var(--gutter)))` width.

- [ ] **Step 1: Make the moves and rewrites.**
- [ ] **Step 2: Check everything.**
  - **Run:** the full check, then `capture t12` and `compare baseline t12`.
  - **Expected:** 0 px on take (timer masked), result and leaderboard.
  - **Browser:** in an existing attempt, picking an option fills its mark and persists across reload. Don't submit.
- [ ] **Step 3: Commit.**
  - `refactor: take, result and leaderboard views use ui components`

### Task 13: Feature `admin`

**Files:**
- Create:
  - `src/features/admin/AdminQuizListView.tsx`
  - `src/features/admin/QuizEditorView.tsx` (title + editor)
  - `src/features/admin/QuizJsonEditor.tsx`, `DeleteQuizButton.tsx` (moved)
  - `src/features/admin/QuizJsonEditor.module.css` (`.help` details, `.editor` textarea with `min-height: 60vh` exempt, `.cancel`)
- Modify: `src/app/admin/quizzes/page.tsx`, `new/page.tsx`, `[quizId]/edit/page.tsx`. `TEMPLATE` stays in `new/page.tsx`, because it's data.
- Delete: `admin.module.css`, `QuizJsonEditor.tsx`, `DeleteQuizButton.tsx` from `src/app`. `PENDING` is now empty.

**Interfaces:**
- **Produces:**
  - `AdminQuizListView({ quizzes })`
  - `QuizEditorView({ heading: ReactNode, initialJson: string, submitUrl: string, method: 'POST'|'PUT' })`, using `Page width="wide"`
- **Consumes:** `PageHeader action={<ButtonLink href="/admin/quizzes/new">New quiz</ButtonLink>}`, `ListRow density="compact" align="baseline"`, `Meta spacing="tight"`, `TextLink`, `TextButton tone="danger"`, `Notice tone="danger" role="alert"`, `Actions gap="tight"`, `Button`.
- **Delete-row error:** `DeleteQuizButton`'s row error becomes `ErrorMessage size="small"` with `flex-basis:100%`. That `flex-basis` lives in `features/admin` CSS.
- **Snapshot delta:** a 0.5rem → 0.25rem shift in the error's top margin is allowed. Ledger a ruling if it shows up in a snapshot; it only appears on error.

- [ ] **Step 1: Make the moves and rewrites.**
- [ ] **Step 2: Check everything.**
  - **Run:** the full check, then `capture t13` and `compare baseline t13`.
  - **Expected:** 0 px on the admin pages.
  - **Browser:** open the "What goes in the JSON" details. A JSON syntax error shows "Fix these before saving:".
- [ ] **Step 3: Commit.**
  - `refactor: admin views use ui components`

### Task 14: Lock it in — ESLint rule, `/design` catalog, focused snapshots, docs

**Files:**
- Modify: `eslint.config.mjs`, adding the `no-restricted-imports` block below. Also `src/styles/tokens.test.ts` (delete the `PENDING_RAW_VALUES` constant and the `pending files still have raw values` test) and `scripts/visual-snapshots.py` (add the focused captures).
- Create: `src/app/design/page.tsx`, which renders `<DesignCatalog />`, plus `src/features/design/DesignCatalog.tsx` and `DesignCatalog.module.css`. Also `docs/DESIGN_SYSTEM.md`, the "how to apply a new design" guide covering the layers, where each kind of change goes, the token list, and the snapshot workflow.
- Delete: `src/app/controls.module.css`. By now nothing imports it, and `grep -r controls.module src` is empty.
- Docs: `SPEC.md` (implementation note with commit range), `CONTEXT.md` (status), `docs/LEARNING_LOG.md` (what and why), `docs/NAVIGATION.md` (add `/design`, unlinked).

**ESLint rule:**

```js
{ files: ['src/app/**/*.{ts,tsx}'],
  rules: { 'no-restricted-imports': ['error', { patterns: [{ group: ['**/*.module.css'], message: 'Routes render Views from src/features; styling lives in src/ui or the feature.' }] }] } }
```

**The `/design` page:**
- **Components:** every `ui` component and variant, with real copy.
- **Color swatches:** list the `--color-*` tokens by name, each with a swatch drawn via `background: var(--color-x)` from an inline `style`. Inline `style` with `var()` is allowed because it isn't a raw value.

- [ ] **Step 1: Write the failing check.**
  - **Setup:** create a scratch file `src/app/__lintcheck.tsx` that imports `./x.module.css`.
  - **Run:** `npx eslint src/app/__lintcheck.tsx`
  - **Expected:** the error is NOT reported yet, because the rule doesn't exist. That's the red state. Add the rule.
  - **Re-run:** `no-restricted-imports` is reported. Delete the scratch file.
- [ ] **Step 2: Tighten the guard.**
  - Remove `PENDING_RAW_VALUES` and its test. Run `npx vitest run src/styles` and expect PASS with no exemptions besides `token-exempt` lines.
  - Run `grep -rn "token-exempt" src` and list each one in `docs/DESIGN_SYSTEM.md`.
- [ ] **Step 3: Build `/design` and the focused snapshots.**
  - **Focused captures:** Tab to the first control on `/login`, and check an option on the take page.
  - **Run:** `capture final` and `compare baseline final`.
  - **Expected:** only the two known deltas (Home h2, quiz bubble), plus new files for `/design` and the focused captures, which are missing in the baseline. Those are reported as missing and are expected.
  - **Prove a redesign path:** temporarily change `--color-accent`, then `--space-unit`, in `tokens.css`, capture, and see every page change. Revert. Mention this in the learning log, not in a commit.
- [ ] **Step 4: Final check.**
  - **Run:** `npm test && npm run lint && npx tsc --noEmit && npx next build`
  - **Expected:** all green.
  - **Run:** `grep -rln "module.css" src/app`. Expected: nothing.
- [ ] **Step 5: Commit** as two commits: `feat: design catalog page and import rule`, then `docs: design system structure and redesign guide`.
