# Design system: how to apply a new design

The app is built in four layers so that a new look is made in a few
places, not in every page.

```
src/app/            Routes only: auth checks, data loading, redirects.
                    Renders one View. No CSS (ESLint blocks *.module.css imports).
src/features/<area> Views and behaviour (forms, buttons that call APIs) for
                    site, home, auth, library, quizzes, attempt, admin, design.
                    Built from @/ui. CSS only for screen-specific pieces.
src/ui/             The design system: presentational components, no data,
                    no API calls. Exported from src/ui/index.ts.
src/styles/tokens.css  Every visual value.
```

## Where each kind of change goes

| You want to change | Edit |
|---|---|
| Colors, fonts, type sizes, spacing, radii, borders, widths | `src/styles/tokens.css` |
| How buttons, links, fields, notices, lists, page headers or the top bar look | the component in `src/ui/` |
| The layout of one screen | its View in `src/features/<area>/` |
| A screen-specific piece (answer-sheet marks, quiz status bubble, take-page bar, result score, leaderboard table, PDF frame, JSON editor) | that feature's `*.module.css` |
| Data, auth or redirects | the route in `src/app/` (the design is untouched) |

Two token edits are enough to restyle every page. Changing
`--color-accent` to teal and `--space-unit` from `0.25rem` to `0.3rem`
changed all 60 page screenshots, without touching a page.

## Tokens

- **Color:** `--color-text`, `--color-bg`, `--color-text-muted`,
  `--color-accent`, `--color-on-accent`, `--color-border`,
  `--color-success`, `--color-danger`. Each one has a dark-mode value
  under `@media (prefers-color-scheme: dark)`.
- **Spacing:** `--space-N = calc(var(--space-unit) * N)`. Fractional
  steps use a dash, for example `--space-2-5`. Change `--space-unit` to
  make everything tighter or roomier.
- **Type:** two font families (`--font-body`, `--font-mono`), sizes from
  `--text-sm` to `--text-stat`, fluid titles (`--text-title-*`,
  `--text-score`), `--weight-*`, `--leading-*` and `--tracking-*`.
- **Shape:** `--radius-*`, `--border-thin/medium/thick`, `--focus-ring`,
  `--focus-offset` and `--underline-offset*`.
- **Layout:** `--width-narrow/medium/default/wide`, `--gutter` and
  `--page-top*`.

The new font goes in `src/app/layout.tsx` (next/font, as `--font-sans`)
and `--font-body` in `tokens.css`.

## Components (`@/ui`)

- **Page structure:** `Page` (`width`, `top`) and `PageHeader` (`title`,
  `intro`, `size`: display, page, cover or sub; plus an optional
  `action`). Also `Heading` and `VisuallyHidden`.
- **Actions:** `Button` and `ButtonLink` (primary or secondary), `TextLink`
  (default or muted), `TextButton` (default or danger), and `Actions`, a
  row of them.
- **Forms:** `Form`, `Field`, `Input`, `ErrorMessage` (body or small), and
  `Notice` (success, accent or danger).
- **Content:** `List` and `ListRow` (with `density` and `align`),
  `Description`, `Meta` (with `spacing` and `tabular`), and `EmptyState`.
- **Navigation:** `TopBar`, `NavLink` (marks the current section) and
  `NavButton`.

All of them are shown with their variants on **`/design`**. That page
isn't linked from the header.

## The guardrails

- **Undefined tokens:** `src/styles/tokens.test.ts` fails if a CSS file
  uses a `var(--…)` that `tokens.css` doesn't define.
- **Dark mode gaps:** the same test fails if dark mode is missing one of
  the color tokens.
- **Raw values:** it also fails if any CSS file other than `tokens.css`
  contains a raw color or a number with `rem`, `em`, `px`, `vh` or `vw`.
  A line can opt out with `/* token-exempt: <reason> */`. Today's
  exemptions:
  - `src/app/globals.css`: `max-width: 100vw` (viewport cap)
  - `src/ui/VisuallyHidden.module.css`: `1px` × 2 (visually-hidden pattern)
  - `src/features/attempt/answerSheet.module.css`: `1px` × 2 (hidden native input)
  - `src/features/admin/QuizJsonEditor.module.css`: `min-height: 60vh`
  - `src/features/library/DocumentView.module.css`: `min-height: 32rem`
  - `src/features/quizzes/QuizRow.module.css`: `max-width: 14rem` and
    `@media (max-width: 34rem)` (media queries can't use custom properties)
- **CSS in routes:** ESLint blocks `*.module.css` imports in
  `src/app/**`.

## Checking a redesign with screenshots

`scripts/visual-snapshots.py` captures every page in light and dark, at
1280px and 360px widths. It also takes two extra captures that need an
interaction first: the focused login field, and a checked answer.

```sh
export SNAP_USER_EMAIL=... SNAP_USER_PASSWORD=...     # any account
export SNAP_ADMIN_EMAIL=... SNAP_ADMIN_PASSWORD=...   # an ADMIN account
export SNAP_QUIZ_ID=... SNAP_TAKE_URL=/quizzes/.../take/... SNAP_RESULT_URL=/quizzes/.../result/...

python3 scripts/visual-snapshots.py capture before
# ...change tokens or ui...
python3 scripts/visual-snapshots.py capture after
python3 scripts/visual-snapshots.py compare before after   # px differing per file
```

**What to expect:**
- For a restructure, every file should show `0 px differ`. For a
  redesign, open the changed files and look at them.
- Pages whose env vars aren't set are skipped.
- While capturing, the script aborts every non-GET `/api/` request
  except login, so opening an expired take page can't submit the
  attempt.
- PDF content and the take-page timer are masked.
- Pages that show live data (quizzes, leaderboard) change whenever
  someone takes a quiz. Capture both runs close together.
