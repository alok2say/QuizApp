import Link from 'next/link'
import { getCurrentUser } from '@/lib/session'
import { SignOutButton } from './SignOutButton'
import { NavLink } from './NavLink'
import styles from './SiteHeader.module.css'

export async function SiteHeader() {
  const user = await getCurrentUser()

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/">DemoQuizApp</Link>

        <nav className={styles.nav} aria-label="Site">
          {user ? (
            <>
              <NavLink className={styles.link} href="/library">Library</NavLink>
              <NavLink className={styles.link} href="/quizzes">Quizzes</NavLink>
              {user.role === 'ADMIN' && (
                <NavLink className={styles.link} href="/admin/quizzes">Admin</NavLink>
              )}
              <SignOutButton className={styles.link} />
            </>
          ) : (
            <>
              <NavLink className={styles.link} href="/library">Library</NavLink>
              <NavLink className={styles.link} href="/login">Log in</NavLink>
              <NavLink className={styles.link} href="/signup">Sign up</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
