import Link from 'next/link'
import { NavLink } from '@/ui'
import { SignOutButton } from './SignOutButton'

// Rendered by the root layout on every page; the layout loads the user
export function SiteHeader({ user }: { user: { role: 'USER' | 'ADMIN' } | null }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex min-h-14 w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="font-semibold tracking-tight">
          DemoQuizApp
        </Link>
        <nav aria-label="Site" className="flex flex-wrap items-center gap-1">
          {user ? (
            <>
              <NavLink href="/library">Library</NavLink>
              <NavLink href="/quizzes">Quizzes</NavLink>
              {user.role === 'ADMIN' && <NavLink href="/admin/quizzes">Admin</NavLink>}
              <SignOutButton />
            </>
          ) : (
            <>
              <NavLink href="/library">Library</NavLink>
              <NavLink href="/login">Log in</NavLink>
              <NavLink href="/signup">Sign up</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
