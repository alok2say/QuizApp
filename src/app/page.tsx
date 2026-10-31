import Link from 'next/link'
import { getCurrentUser } from '@/lib/session'
import styles from './page.module.css'

export default async function Home() {
  const user = await getCurrentUser()

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>DemoQuizApp</h1>
        <p className={styles.intro}>Take a quiz and see where you rank.</p>

        <nav className={styles.actions} aria-label="Main">
          {user ? (
            <Link className={styles.primary} href="/quizzes">Browse quizzes</Link>
          ) : (
            <Link className={styles.primary} href="/login">Log in</Link>
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
