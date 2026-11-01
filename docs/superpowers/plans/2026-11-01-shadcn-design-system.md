# shadcn Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every screen of DemoQuizApp on Tailwind v4 and shadcn (base-nova) components. Delete the CSS modules and `tokens.css`. Behaviour and copy stay the same.

**Architecture:**
- **Setup:** Tailwind v4 via PostCSS, then shadcn init with its defaults.
- **Theme:** lives only in `globals.css`. Dark mode follows the device via a media-query `dark` variant.
- **Views:** `src/features/*` Views use `@/components/ui/*` directly.
- **`src/ui`:** shrinks to `Page`, `PageHeader`, `EmptyState` and `NavLink`.
- **During migration:** a ratchet test lists the CSS modules not yet migrated. Each task deletes its own. The old token file goes last.

**Tech Stack:**
- Next.js 16.3.1, React 19.2
- Tailwind CSS v4 (`tailwindcss`, `@tailwindcss/postcss`, `postcss`)
- shadcn 4.23 preset `base-nova` (`@base-ui/react`, `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`)
- Vitest, ESLint
- Python Playwright (for browser checks)

**Spec:** `SPEC.md` → "shadcn design system (designed 2026-11-01)" (commit `feb9452`).

## Global Constraints

- **Registry for every npm/npx command:** prefix it with `npm_config_registry=https://registry.npmjs.org NODE_AUTH_TOKEN=$(gh auth token --user alok2say)`.
- **Adding components:** `npx shadcn@latest add <names> --yes`. Use whatever API the generated file exports. Read it before using it, because Base UI APIs differ from Radix.
- **Copy:** every user-facing string stays identical. The only new copy is the dialog buttons: "Cancel", "Delete", "Replace".
- **Behaviour must not change:** fetch calls, redirects, timer and deadline logic, localStorage keys, the hydration gate, focus-on-navigate, and `aria-*` labels on bubbles and summaries.
- **Routes:** `src/app/**` keeps no styling. The ESLint `no-restricted-imports` rule stays.
- **No arbitrary Tailwind values** (`-[…]`) in `src/features` or `src/ui`. Use theme scale classes.
- **Dark mode:** `@custom-variant dark (@media (prefers-color-scheme: dark));`, with the dark variable block inside `@media (prefers-color-scheme: dark) { :root { … } }`.
- **Dev server:** already running on :3000 (task `ba3s9id2a`). Don't start another one.
- **Test data:** browser checks use the test accounts in `CONTEXT.md`. Abort `/api/attempts/**` and admin writes except where a step says to submit or delete for real.
- **Commits:** each one ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **RadioGroup/Checkbox on the take page.** Base UI's controlled API (`value`/`onValueChange`, `checked`/`onCheckedChange`) must keep the same answers state and localStorage writes as the old native inputs. A wrong prop silently stops saving picks. Task 8 checks pick → reload → still picked.
2. **AlertDialog replacing `window.confirm`.** Cancel must do nothing, and confirm must run the same request as before. Upload-replace happens after the file is read. Task 9 checks both paths in the browser.
3. **Hydration and `'use client'`.** shadcn Base UI components are client components. Server Views that import them must still build, and the take-page hydration gate must stay. `next build` runs in every task.
4. **Dark mode via media query.** shadcn's `dark:` classes must follow `prefers-color-scheme`. Every task screenshots both schemes.
5. **Accessible names.** Nav `aria-current`, bubble labels "Question N, answered", the summary dots' `aria-label`, the visually-hidden table head, and `role="alert"` on errors must survive the rewrite. Task 10 greps for each before the final capture.

---

### Task 1: Tailwind v4 + shadcn init + components

**Files:**
- Create: `postcss.config.mjs`, `components.json`, `src/lib/utils.ts`, `src/components/ui/*`
- Modify: `package.json`, `package-lock.json`, `src/app/globals.css`, `src/app/layout.tsx` (Geist is added by init; drop the Bricolage import), `src/styles/tokens.test.ts` (from here on it only checks CSS modules)

**Interfaces:**
- Produces:
  - `cn()` from `@/lib/utils`
  - shadcn components in `@/components/ui/`: `button`, `card`, `badge`, `input`, `label`, `field`, `alert`, `table`, `textarea`, `collapsible`, `alert-dialog`, `radio-group`, `checkbox`, `progress`, `separator`
  - theme classes such as `bg-background`, `text-muted-foreground`, `text-destructive`, `text-success`, `bg-success`

- [ ] **Step 1: Install Tailwind.**
  - `npm i -D tailwindcss @tailwindcss/postcss postcss`
  - Write `postcss.config.mjs` exporting `{ plugins: { "@tailwindcss/postcss": {} } }`.
  - Add `@import "tailwindcss";` as the first line of `globals.css`.
- [ ] **Step 2: Run init.**
  - `CI=1 npx shadcn@latest init --defaults --yes --no-monorepo < /dev/null`
  - Expected: "Project initialization completed", and `components.json` with `"style": "base-nova"`.
- [ ] **Step 3: Add the components.**
  - `npx shadcn@latest add card badge input label field alert table textarea collapsible alert-dialog radio-group checkbox progress separator --yes`
  - Expected: one file each in `src/components/ui/`. If a name doesn't exist in the registry, ledger a ruling and pick the nearest equivalent.
- [ ] **Step 4: Fix up the theme.**
  - Replace init's `@custom-variant dark (&:is(.dark *));` with the media variant from Global Constraints, and move the `.dark { … }` block into `@media (prefers-color-scheme: dark) { :root { … } }`.
  - Add `--success` in light (`oklch(0.527 0.154 150.069)`) and dark (`oklch(0.723 0.219 149.579)`), plus `--success-foreground: oklch(0.985 0 0)`.
  - Add `--color-success: var(--success)` and `--color-success-foreground: var(--success-foreground)` to `@theme inline`.
  - Keep the old reset rules from `globals.css` (body flex column, `overflow-x: clip`) below `@layer base`.
- [ ] **Step 5: Check that everything still builds.**
  - Run: `npm test && npm run lint && npx tsc --noEmit && npx next build`
  - Expected: all green. The old pages still render; Tailwind's preflight reset shifts them, which is expected mid-migration.
  - If the `tokens.test.ts` raw-value test now fails on `globals.css`, exclude `globals.css` from it and ledger a ruling. Task 10 deletes that test.
- [ ] **Step 6: Commit.**
  - `build: add Tailwind v4 and shadcn (base-nova) with components`

### Task 2: Design guards (ratchet) + `src/ui` layout pieces

**Files:**
- Create: `src/design-guards.test.ts`
- Rewrite: `src/ui/Page.tsx`, `src/ui/PageHeader.tsx`, `src/ui/EmptyState.tsx` and `src/ui/NavLink.tsx` with Tailwind. Delete their `.module.css` files.
- Rewrite: `src/ui/layout.test.tsx` and `src/ui/nav.test.tsx` to match.
- Modify: `src/ui/index.ts` (still exports the old components that unmigrated features use)

**Interfaces:**
- Produces:
  - `Page({ width?: 'narrow'|'default'|'wide', children })` → `<main class="mx-auto w-full px-4 py-10 …max-w-sm|max-w-3xl|max-w-5xl">`. The extra `top` prop is dropped.
  - `PageHeader({ title, description?, action? })` → `h1` (`text-3xl font-semibold tracking-tight`) and an optional `p.text-muted-foreground`. `action` sits on the right in a flex row.
  - `EmptyState({ children })` → `p.text-muted-foreground`.
  - `NavLink({ href, children })`, which keeps `aria-current` via `isActivePath` and is styled with `buttonVariants({ variant: 'ghost', size: 'sm' })`. Active state: `aria-[current=page]:bg-muted aria-[current=page]:text-foreground`.
  - `PENDING_MODULES: string[]` in `design-guards.test.ts`.

- [ ] **Step 1: Write the failing guard tests** in `src/design-guards.test.ts`. They walk `src` with `readdirSync({recursive:true})`.
  - `no CSS modules outside the pending list`: `*.module.css` files not in `PENDING_MODULES` → `expect([]).toEqual([])`-style assertion.
  - `pending modules still exist`: each entry in `PENDING_MODULES` must exist.
  - `no color literals outside globals.css`: no `/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i` in `.css`, `.ts` or `.tsx` under `src`, except `src/app/globals.css` and test files.
  - `no arbitrary Tailwind values in features and ui`: no `/\b[\w:-]+-\[[^\]]+\]/` in `src/features/**/*.tsx` or `src/ui/**/*.tsx`.
  - **Initial `PENDING_MODULES`:** every `*.module.css` that still exists, except the four `src/ui` files this task deletes.
  - Run `npx vitest run src/design-guards.test.ts`. Expected: FAIL on the `src/ui` modules this task is about to delete, which aren't on the pending list.
- [ ] **Step 2: Update the ui tests first.**
  - **Page:** the `width` class.
  - **PageHeader:** `h1` before the description, and the action rendered.
  - **NavLink:** `href`, and no `aria-current` outside a router.
  - Watch them FAIL against the old components.
- [ ] **Step 3: Rewrite the four components** with Tailwind and delete their module CSS.
- [ ] **Step 4: Run everything.**
  - Run: `npx vitest run src/ui src/design-guards.test.ts`, then `npm test && npm run lint && npx tsc --noEmit && npx next build`.
  - Expected: PASS and green. Views that still use `Page top=` get a type error; drop that prop at their call sites in this task (Home, auth).
- [ ] **Step 5: Commit.**
  - `feat(ui): Tailwind page shell, header, empty state and nav link; design guards`

### Task 3: Site header + Home

**Files:**
- Modify: `src/features/site/SiteHeader.tsx`, `src/features/site/SignOutButton.tsx`, `src/features/home/HomeView.tsx`
- Delete: `src/features/home/HomeView.module.css`, `src/ui/TopBar.tsx`, `TopBar.module.css` (and remove them from `PENDING_MODULES`)

**Interfaces:**
- Consumes: `NavLink`, `Button` / `buttonVariants` from `@/components/ui/button`, and `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- Produces:
  - **Header:** a `<header class="border-b">`, with an inner `max-w-3xl` row holding the brand link (`font-semibold`), then a `<nav aria-label="Site">` of `NavLink`s. Log out is `<Button variant="ghost" size="sm">`.
  - **Home:**
    - `Page` with `PageHeader` ("DemoQuizApp" / "Take a quiz and see where you rank.").
    - The primary action in a `nav aria-label="Main"` as a `Button` rendering a Next `Link`. Use the Button's `render` prop if the generated Base UI button has one; otherwise use `buttonVariants()` on a `Link`.
    - Two Cards: "Books" with a "Browse the library" link button, and "Events" with "Meetups will show up here."

- [ ] **Step 1: Rewrite** the header and Home. Remove the deleted files from `PENDING_MODULES`.
- [ ] **Step 2: Run the checks.**
  - Run: `npm test && npm run lint && npx tsc --noEmit && npx next build`. Expected: green.
  - Screenshot `/` signed out and in, light and dark, at 1280 and 360, with Playwright. Look at each one.
  - Check that `aria-current="page"` is set on the active nav link.
- [ ] **Step 3: Commit.**
  - `feat: header and home on shadcn`

### Task 4: Auth — login, signup

**Files:**
- Modify: `src/features/auth/LoginForm.tsx`, `SignupForm.tsx`
- Delete: `src/features/auth/auth.module.css`

**Interfaces:**
- **Layout:** `Page width="narrow"` holds a `Card` (CardHeader → CardTitle "Log in" / CardDescription "Pick up where you left off."), then CardContent with the form.
- **Fields:** each one is the generated `Field` + `FieldLabel` (or `Label`) + `Input`. "At least 8 characters" goes in the field's description element.
- **Errors:** `Alert variant="destructive"` with `role="alert"` and `AlertDescription`.
- **"Account created":** an `Alert` with a `CircleCheck` icon.
- **Submit:** a full-width `Button type="submit"`.
- **Cross-link:** a `CardFooter` with the "New here? Create an account" link (`underline-offset-4 hover:underline`).

- [ ] **Step 1: Rewrite both forms.**
- [ ] **Step 2: Run the checks.**
  - Run: the full check from Task 3.
  - **Browser:** a wrong password shows the destructive Alert; `/login?created=1` shows the success Alert; screenshots in both schemes.
- [ ] **Step 3: Commit.**
  - `feat: auth forms on shadcn`

### Task 5: Library

**Files:**
- Modify: `src/features/library/LibraryListView.tsx`, `DocumentView.tsx`
- Delete: `src/features/library/DocumentView.module.css`

**Interfaces:**
- **List:** a grid of `Card`s (`grid gap-4 sm:grid-cols-2`). Each card has the title, description, a `Badge variant="secondary"` "N pages", and a "Read" `Button variant="outline"` link.
- **Document view:**
  - The header row has a "‹ Library" `Button variant="link"`, then an `h1`.
  - The frame is `relative flex-1 min-h-96 border-t`. This is the scale value nearest the old 32rem, so ledger it as a ruling.
  - `PdfReader` stays absolutely positioned inside the frame.

- [ ] **Step 1: Rewrite.**
- [ ] **Step 2: Run the checks.**
  - Run: the full check.
  - **Browser:** `pdf-reader-load` fires with pageCount 8; screenshots.
- [ ] **Step 3: Commit.**
  - `feat: library on shadcn`

### Task 6: Quiz list + StartQuizButton

**Files:**
- Modify: `src/features/quizzes/QuizListView.tsx`, `StartQuizButton.tsx`
- Delete: `src/features/quizzes/QuizRow.module.css`

**Interfaces:**
- **Each quiz is a `Card`:**
  - CardHeader: the title, plus the description if there is one.
  - A status `Badge`: "Not started" (`outline`), "In progress" (`secondary`), "Completed" (`default`). The existing `aria-label` becomes visible text.
  - Meta line: "Scored N" or "In progress", "N min", and a "Leaderboard" link.
  - CardFooter: the action.
- **`StartQuizButton({ quizId, label, variant?: 'default'|'outline' })`:** the old `'primary'|'secondary'` values are renamed to shadcn's. Update callers in result and leaderboard. Errors render as `p role="alert" class="text-sm text-destructive mt-2"`.

- [ ] **Step 1: Rewrite** both, and update the callers.
- [ ] **Step 2: Run the checks.**
  - Run: the full check.
  - **Browser:** a forced 500 with a JSON body on start shows the error; screenshots.
- [ ] **Step 3: Commit.**
  - `feat: quiz list on shadcn`

### Task 7: Result + Leaderboard

**Files:**
- Modify: `src/features/attempt/ResultView.tsx`, `LeaderboardView.tsx`
- Delete: `ResultView.module.css`, `LeaderboardView.module.css`

**Interfaces:**
- **Result page:**
  - **Score Card:** CardDescription is the quiz title; the score is `text-6xl font-bold tabular-nums` with "/ max" muted.
  - **Summary:** a row of icon links (`CircleCheck` `text-success` / `CircleX` `text-destructive`) with the existing `aria-label`s.
  - **Actions:** a "Retake quiz" `StartQuizButton` and a "See leaderboard" `Button variant="link"`.
  - **Each question is a `Card` with `id="q-N"`:**
    - CardTitle shows "N. text" and a "awarded / points" `Badge`.
    - The options list shows a letter, the text, and a `Badge` "Correct answer" (`success`-styled) and/or "Your answer" (`secondary`). A wrong pick gets `destructive`.
    - The old `sr-only` text is no longer needed because the badges are visible. Ledger that as a ruling.
- **Leaderboard page:**
  - `PageHeader`, then the shadcn `Table` with a visible `TableHeader` (Rank, Name, Score, Time). The old one was visually hidden; a visible header is the standard shadcn look, so ledger a ruling.
  - Your own row gets `bg-muted font-medium`, and its name reads "You".
  - Your best score outside the top N goes in an `Alert`.
  - The empty state and the "Take the quiz" call to action keep their copy.

- [ ] **Step 1: Rewrite.**
- [ ] **Step 2: Run the checks.**
  - Run: the full check.
  - **Browser:** the result page for `SNAP_RESULT_URL`, and the leaderboard for Sample Quiz; screenshots in both schemes.
- [ ] **Step 3: Commit.**
  - `feat: result and leaderboard on shadcn`

### Task 8: Take quiz

**Files:**
- Modify: `src/features/attempt/QuizTakeForm.tsx`
- Delete: `TakeView.module.css`, `answerSheet.module.css`

**Interfaces:**
- **Kept unchanged:** `questionNav.ts` and its tests, and every bit of logic (deadline, submit, `useEffectEvent`, the hydration gate, localStorage keys, `goTo`, focus on `<legend tabIndex=-1>`).
- **Sticky top bar:**
  - The title, and the timer as a `Badge`. Under 60s the Badge is `variant="destructive"`; otherwise `outline`, with `tabular-nums` and the same `aria-label`.
  - `Progress value={answered/total*100}` with `aria-label="Answered"`.
  - The bubble buttons become `Button size="icon-sm"`: `default` when answered, `outline` when not. The current one gets `ring-2 ring-ring ring-offset-2 ring-offset-background`. `aria-label` and `aria-current="step"` are unchanged. "Question N of M" stays.
- **The question is a `Card`:**
  - CardHeader holds the muted number and a `<legend>` CardTitle inside a `<fieldset>`.
  - For single-select, the options are a `RadioGroup value={picked[0] ?? ''} onValueChange={(v) => toggleOption(q, v)}`. Each row is a `Label` wrapping a `RadioGroupItem value={option.id}` and the text, `flex items-center gap-3 rounded-md border p-3`.
  - For multi-select, each row is a `Checkbox checked={picked.includes(id)} onCheckedChange={() => toggleOption(q, id)}`. Keep the "Pick all that apply" hint.
- **Sticky footer:** Previous (`outline`), progress text, Next (`default`) / Submit answers. Copy is unchanged.

- [ ] **Step 1: Rewrite** the markup only; leave the logic as it is.
- [ ] **Step 2: Run the checks.**
  - Run: the full check. `questionNav` tests still pass.
  - **Browser** (`quiztest.user`, open attempt, `/api/attempts/**` aborted):
    - Pick a radio, then pick 2 checkboxes on Q3.
    - Reload. Expected: still on Q3, both checkboxes checked, the answered count right.
    - Next/Previous move focus to the legend.
    - Light, dark, and 360px screenshots.
- [ ] **Step 3: Commit.**
  - `feat: take quiz on shadcn`

### Task 9: Admin — list, delete dialog, editor

**Files:**
- Modify: `src/features/admin/AdminQuizListView.tsx`, `DeleteQuizButton.tsx`, `QuizEditorView.tsx`, `QuizJsonEditor.tsx`
- Delete: `AdminQuizListView.module.css`, `QuizJsonEditor.module.css`

**Interfaces:**
- **List page:**
  - `PageHeader` with "Manage quizzes" and a "New quiz" `Button` link as its `action`.
  - A `Table` with columns Title, Questions, Added and Actions.
  - The Actions cell holds an "Edit" `Button variant="link"` and `DeleteQuizButton`.
- **`DeleteQuizButton`:**
  - An `AlertDialog` triggered by a `Button variant="ghost" size="sm" class="text-destructive"` labelled "Delete".
  - Title: "Delete this quiz?". Description: "This cannot be undone."
  - Buttons: Cancel, and a destructive action labelled "Delete".
  - Confirming runs the same `fetch DELETE`, then `router.refresh()`, and shows the error text as before. "Deleting…" shows while it's pending.
- **Editor:**
  - "What goes in the JSON" becomes a `Collapsible` (trigger `Button variant="ghost"` with a `ChevronDown`), with the same list inside.
  - The JSON box is a `Textarea` with `font-mono min-h-96`, `aria-label="Quiz JSON"` and `spellCheck={false}`.
  - Errors are an `Alert variant="destructive"` with `AlertTitle` "Fix these before saving:" and a list. Server errors show `AlertDescription` only.
  - Actions: Save (`default`), Download / Upload (`outline`), Cancel (`Button variant="link"` pushed right with `ml-auto`).
  - **Upload:** read the file first. If the editor has content, open a controlled `AlertDialog` ("This will replace the current editor content. Continue?", Cancel / Replace) and only `setText` on Replace.

- [ ] **Step 1: Rewrite.**
- [ ] **Step 2: Run the checks.**
  - Run: the full check.
  - **Browser** (admin account, admin API aborted except where noted):
    - Delete → Cancel → no request is sent.
    - Delete → Delete → one `DELETE` request is attempted (aborted) and the error is shown.
    - JSON syntax error → the "Fix these before saving:" Alert.
    - Upload a file → the Replace dialog → Cancel keeps the text, Replace swaps it in.
    - Screenshots.
- [ ] **Step 3: Commit.**
  - `feat: admin on shadcn with confirm dialogs`

### Task 10: Remove the old system, `/design` catalog, docs

**Files:**
- Delete:
  - `src/styles/tokens.css` and `src/styles/tokens.test.ts`, plus the `@/styles/tokens.css` import in `layout.tsx`
  - every remaining old `src/ui` component and its tests (`Button`, `TextLink`, `Form`, `Notice`, `List`, `Text`, `Actions`, `Heading`, `VisuallyHidden`, and their `*.module.css`)
  - `src/features/design/DesignCatalog.module.css`
- Rewrite: `src/features/design/DesignCatalog.tsx`. It shows the shadcn components in use with their variants and the theme color swatches (`bg-primary`, `bg-secondary`, `bg-muted`, `bg-accent`, `bg-destructive`, `bg-success`, `border`).
- Modify:
  - `src/design-guards.test.ts`: remove the `PENDING_MODULES` list, its test, and the `pending modules still exist` test.
  - `src/ui/index.ts`: export only `Page`, `PageHeader`, `EmptyState` and `NavLink`.
  - `scripts/visual-snapshots.py`: update its docstring to say it's a review tool, not a parity gate.
- Docs:
  - `docs/DESIGN_SYSTEM.md`: rewrite it with the theme variables, the component map, how to add a component (with the registry command), and how to retheme (edit the variables, or `npx shadcn apply <preset>`).
  - `SPEC.md`: an implementation note.
  - `CONTEXT.md`: status, plus the registry command.
  - `docs/LEARNING_LOG.md`: what and why.

- [ ] **Step 1: Delete and rewrite.** Then run `grep -rn "module.css\|@/styles/tokens\|var(--color-\|var(--space-" src`. Expected: nothing.
- [ ] **Step 2: Run the checks.**
  - Run: `npm test && npm run lint && npx tsc --noEmit && npx next build`. Expected: green, with guards active and no pending list.
  - Capture all pages with `python3 scripts/visual-snapshots.py capture shadcn` and look at every image in both schemes and widths. Note anything off and fix it in this task.
- [ ] **Step 3: Commit** in two commits:
  - `feat: shadcn design catalog; remove the old design system`
  - `docs: shadcn design system guide`
