import { Bricolage_Grotesque } from 'next/font/google'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/session'
import { SignOutButton } from './SignOutButton'
import styles from './page.module.css'

const bricolage = Bricolage_Grotesque({ subsets: ['latin'] })

export default async function Home() {
  const user = await getCurrentUser()

  return (
    <div className={`${styles.page} ${bricolage.className}`}>
      <main className={styles.main}>
        <h1 className={styles.title}>DemoQuizApp</h1>
        <p className={styles.intro}>Take a quiz and see where you rank.</p>

        <nav className={styles.actions} aria-label="Main">
          {user ? (
            <>
              <Link className={styles.primary} href="/quizzes">Browse quizzes</Link>
              {user.role === 'ADMIN' && (
                <Link className={styles.link} href="/admin/quizzes">Manage quizzes</Link>
              )}
              <SignOutButton className={styles.link} />
            </>
          ) : (
            <>
              <Link className={styles.primary} href="/login">Log in</Link>
              <Link className={styles.link} href="/signup">Sign up</Link>
            </>
          )}
        </nav>

        <section className={styles.placeholder} aria-labelledby="books-events">
          <h2 id="books-events">Books and events</h2>
          <p>Reading lists and meetups will show up here.</p>
        </section>
      </main>
    </div>
  )
}
