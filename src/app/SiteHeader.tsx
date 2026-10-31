import Link from 'next/link'
import { getCurrentUser } from '@/lib/session'
import { SignOutButton } from './SignOutButton'
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
              <Link className={styles.link} href="/quizzes">Quizzes</Link>
              {user.role === 'ADMIN' && (
                <Link className={styles.link} href="/admin/quizzes">Admin</Link>
              )}
              <SignOutButton className={styles.link} />
            </>
          ) : (
            <>
              <Link className={styles.link} href="/login">Log in</Link>
              <Link className={styles.link} href="/signup">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
