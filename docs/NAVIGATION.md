# Pages & Navigation

Snapshot as of 2026-10-31 (after commit `6601527`, PDF library). Describes what's in
the code today, not the target design — see `SPEC.md` "Pages & Routes"
for that.

## Access control

`src/middleware.ts` runs on `/quizzes/:path*` and `/admin/:path*` and
checks the JWT role via `isAuthorizedForPath` (`src/lib/authorization.ts`):

- **Public:** `/`, `/login`, `/signup`, `/library`, `/library/[slug]` (not in the middleware matcher)
- **Logged in (`USER` or `ADMIN`):** everything under `/quizzes`
- **`ADMIN` only:** everything under `/admin`

Unauthorized requests are redirected to `/login?callbackUrl=<original
path + query>`. Each protected page
also calls `getCurrentUser()` and redirects to `/login` itself as a
second check.

## Pages

| Page | URL | Access | Purpose |
|---|---|---|---|
| Home | `/` | Public | Title, intro, role-aware actions, "Books and events" placeholder |
| Library | `/library` | Public | PDFs shipped with the app: title, description, page count, Read |
| Document | `/library/[slug]` | Public | In-app PDF viewer (search, zoom, thumbnails); unknown slug → 404 |
| Login | `/login` | Public | Email + password sign-in |
| Signup | `/signup` | Public | Create account |
| Quiz list | `/quizzes` | Logged in | All quizzes with your status (○ not started / ◐ in progress / ● submitted) and Start / Resume / Retake |
| Take quiz | `/quizzes/[quizId]/take/[attemptId]` | Logged in | Questions, countdown timer, answers cached in `localStorage` |
| Result | `/quizzes/[quizId]/result/[attemptId]` | Logged in | Score + per-question correct/selected answers |
| Leaderboard | `/quizzes/[quizId]/leaderboard` | Logged in | Top N for one quiz + your own rank |
| Admin quiz list | `/admin/quizzes` | Admin | All quizzes with Edit / Delete |
| New quiz | `/admin/quizzes/new` | Admin | JSON editor (download / upload) |
| Edit quiz | `/admin/quizzes/[quizId]/edit` | Admin | Same editor, pre-filled with the quiz's JSON |
| Design system | `/design` | Public, not linked | Every `@/ui` component and color token, for checking a design change (see `docs/DESIGN_SYSTEM.md`) |

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
   DemoQuizApp → /        logged out: Library · Log in · Sign up
                          logged in:  Library · Quizzes · Admin (ADMIN only) · Log out

 /library ──"Read"──► /library/[slug] ──"Library"──► /library
 Home "Browse the library" ──► /library

 Home /  ── "Browse quizzes" (logged in) or "Log in" (logged out)

 /signup ──success──► /login?created=1 ──success──► callbackUrl if present and safe, else /
                                            (header refreshes)

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
- **Any protected page while logged out / wrong role** →
  `/login?callbackUrl=…`; after login you return there
  (`safeCallbackUrl()` rejects anything but same-site paths).

## Known navigation gaps

Closed by the shared header (`7f03983`): no way back to Home from most
pages, login/signup not linked, admin pages with no way out, result/
leaderboard with no route to `/quizzes` (now via header "Quizzes").

Closed by `be5d37a`: post-login now returns to the requested page.

Closed by `a162757`: login ↔ signup cross-links keep `callbackUrl`;
signup → `/login?created=1` (+ `callbackUrl`) → original page.

Closed later on 2026-10-31: the header highlights the current section
(`aria-current="page"`; Quizzes covers all `/quizzes/*`, Admin all
`/admin/quizzes/*`).

No known navigation gaps remain.
