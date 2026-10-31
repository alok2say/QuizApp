# Pages & Navigation

Snapshot as of 2026-10-31 (after commit `7f03983`, shared site header). Describes what's in
the code today, not the target design — see `SPEC.md` "Pages & Routes"
for that.

## Access control

`src/middleware.ts` runs on `/quizzes/:path*` and `/admin/:path*` and
checks the JWT role via `isAuthorizedForPath` (`src/lib/authorization.ts`):

- **Public:** `/`, `/login`, `/signup`
- **Logged in (`USER` or `ADMIN`):** everything under `/quizzes`
- **`ADMIN` only:** everything under `/admin`

Unauthorized requests are redirected to `/login`. Each protected page
also calls `getCurrentUser()` and redirects to `/login` itself as a
second check.

## Pages

| Page | URL | Access | Purpose |
|---|---|---|---|
| Home | `/` | Public | Title, intro, role-aware actions, "Books and events" placeholder |
| Login | `/login` | Public | Email + password sign-in |
| Signup | `/signup` | Public | Create account |
| Quiz list | `/quizzes` | Logged in | All quizzes with your status (○ not started / ◐ in progress / ● submitted) and Start / Resume / Retake |
| Take quiz | `/quizzes/[quizId]/take/[attemptId]` | Logged in | Questions, countdown timer, answers cached in `localStorage` |
| Result | `/quizzes/[quizId]/result/[attemptId]` | Logged in | Score + per-question correct/selected answers |
| Leaderboard | `/quizzes/[quizId]/leaderboard` | Logged in | Top N for one quiz + your own rank |
| Admin quiz list | `/admin/quizzes` | Admin | All quizzes with Edit / Delete |
| New quiz | `/admin/quizzes/new` | Admin | JSON editor (download / upload) |
| Edit quiz | `/admin/quizzes/[quizId]/edit` | Admin | Same editor, pre-filled with the quiz's JSON |

### API routes (called by pages, not navigated to)

| Route | Used by |
|---|---|
| `POST /api/signup` | Signup page |
| `/api/auth/[...nextauth]` | Login (`signIn`) / Log out (`signOut`) |
| `POST /api/quizzes/[quizId]/start` | `StartQuizButton` |
| `POST /api/attempts/[attemptId]/submit` | `QuizTakeForm` |
| `POST /api/admin/quizzes` | New quiz editor |
| `PUT` / `DELETE /api/admin/quizzes/[quizId]` | Edit quiz editor / `DeleteQuizButton` |

## Navigation map

```
 Shared header on every page (layout.tsx → SiteHeader):
   DemoQuizApp → /        logged out: Log in · Sign up
                          logged in:  Quizzes · Admin (ADMIN only) · Log out

 Home /  ── "Browse quizzes" (logged in) or "Log in" (logged out)

 /signup ──success──► /login ──success──► /   (always Home; header refreshes)

 /quizzes ──Start/Resume/Retake──► /take/[attemptId] ──submit or timer expiry──► /result/[attemptId]
    │  ▲                                                                            │
    │  └── "Take it now" (leaderboard, if not yet attempted)                        │
    ├──"Leaderboard"──► /quizzes/[id]/leaderboard ◄───────"View Leaderboard"────────┘
    └──"View result" (SINGLE_ATTEMPT quizzes)──► /result/[attemptId]

 /admin/quizzes ──"New Quiz"──► /admin/quizzes/new ──save──► /admin/quizzes
       └────────"Edit"────────► /admin/quizzes/[id]/edit ──save──► /admin/quizzes

 Log out (header) → /
```

### Automatic redirects

- **Start quiz** (`StartQuizButton`): creates an attempt → take page. On
  `409` (single-attempt quiz already started/submitted) → resumes the
  existing attempt or goes to its result.
- **Take page, attempt already submitted** → result page (can't re-take
  a submitted attempt by URL).
- **Result page, attempt not yet submitted** (`409`) → take page.
- **Any protected page while logged out / wrong role** → `/login`.

## Known navigation gaps

Closed by the shared header (`7f03983`): no way back to Home from most
pages, login/signup not linked, admin pages with no way out, result/
leaderboard with no route to `/quizzes` (now via header "Quizzes").

Still open:
1. Post-login always lands on `/` instead of the originally requested
   page (no `callbackUrl` handling).
2. No active-link highlighting in the header.
