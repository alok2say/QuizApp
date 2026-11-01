# Design system: shadcn on Tailwind

Every screen is built from [shadcn](https://ui.shadcn.com) components on
Tailwind CSS v4, preset `base-nova` (Base UI primitives, neutral palette,
Geist font, `lucide-react` icons). The look is shadcn's standard one,
the same everywhere.

```
src/app/                 Routes only: auth, data, redirects. No styling (ESLint).
src/features/<area>/     Views and behaviour; built from @/components/ui with
                         Tailwind classes.
src/components/ui/       shadcn components (generated, ours to edit).
src/ui/                  App-level layout shadcn doesn't have:
                         Page, PageHeader, EmptyState, NavLink.
src/app/globals.css      The theme: shadcn's CSS variables, light and dark.
```

## Changing the look

| You want to change | Do this |
|---|---|
| Colors, radius | Edit the variables in `src/app/globals.css`: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--ring`, `--radius`, plus `--success` (our addition). Light values sit in `:root`; dark values in `@media (prefers-color-scheme: dark)`. |
| The whole style | Apply another shadcn preset: `npx shadcn@latest apply <preset>` (see the registry note below). |
| How one component looks everywhere | Edit its file in `src/components/ui/` (e.g. `button.tsx` variants). |
| One screen's layout | Its View in `src/features/<area>/` |
| The font | `src/app/layout.tsx` (next/font, exposed as `--font-sans`) |

Dark mode follows the device setting: the Tailwind `dark` variant is
`@media (prefers-color-scheme: dark)`, so every `dark:` class and the
dark variables switch together. There is no toggle.

## Which component where

| Screen | Components |
|---|---|
| Header | `NavLink` (ghost Button style, `aria-current` for the section), ghost `Button` for Log out |
| Home, library, quiz list | `Card`; `Badge` for page count and quiz status |
| Login, signup | `Card` with `Field` / `FieldLabel` / `Input` / `FieldDescription`, `Alert` for errors and "Account created" |
| Take quiz | `Badge` timer, `Progress`, numbered icon `Button`s, `Card` per question, `RadioGroup` / `Checkbox` |
| Result | score `Card`, per-question `Card`s with `Badge`s |
| Leaderboard, admin list | `Table` inside a `Card` |
| Quiz editor | `Collapsible`, `Textarea`, destructive `Alert`, `AlertDialog` for Upload replace |
| Delete quiz | `AlertDialog` |

Link-buttons put `buttonVariants()` on a Next `Link`. The generated
`Alert` always has `role="alert"`; pass `role="status"` for non-error
messages.

All of them, with variants and the color swatches, are on **`/design`**
(not linked from the header).

## Adding a component

The global npm config points at an expired Artifactory login, so use the
public registry:

```sh
npm_config_registry=https://registry.npmjs.org npx shadcn@latest add dialog
```

Read the generated file before using it: these are Base UI components,
whose props differ from the Radix ones in most shadcn examples
(`value` / `onValueChange` on `RadioGroup`, `checked` / `onCheckedChange`
on `Checkbox`, `render` instead of `asChild`).

A full `npm install` also needs `NODE_AUTH_TOKEN` because of
`@alok2say/pdf-reader` (see `CONTEXT.md`).

## Guardrails

`src/design-guards.test.ts` fails when:
- any `*.module.css` file exists, or any stylesheet besides
  `src/app/globals.css`;
- a color literal (hex, `rgb()`, `hsl()`, `oklch()`) appears outside
  `globals.css`;
- a Tailwind arbitrary value such as `p-[13px]` appears in
  `src/features` or `src/ui` (arbitrary variants like
  `aria-[current=page]:` are fine).

ESLint blocks CSS imports in `src/app/**`.

## Reviewing a change with screenshots

`scripts/visual-snapshots.py` captures every page in light and dark at
1280px and 360px. It's a review tool, not a pass/fail gate.

```sh
python3 scripts/visual-snapshots.py capture before
# ...edit the theme or a component...
python3 scripts/visual-snapshots.py capture after
python3 scripts/visual-snapshots.py compare before after
```

The env vars it needs (test accounts, quiz and attempt URLs) are
described at the top of the script; the dev accounts are in `CONTEXT.md`.
