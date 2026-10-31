import { NavLink, TopBar } from '@/ui'
import { SignOutButton } from './SignOutButton'

// Rendered by the root layout on every page; the layout loads the user
export function SiteHeader({ user }: { user: { role: 'USER' | 'ADMIN' } | null }) {
  return (
    <TopBar brand={{ label: 'DemoQuizApp', href: '/' }} navLabel="Site">
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
    </TopBar>
  )
}
