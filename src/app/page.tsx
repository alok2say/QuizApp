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

        <section className={styles.books} aria-labelledby="books">
          <h2 id="books">Books</h2>
          <p>Read the documents in the library.</p>
          <Link className={styles.link} href="/library">Browse the library</Link>
        </section>

        <section className={styles.placeholder} aria-labelledby="events">
          <h2 id="events">Events</h2>
          <p>Meetups will show up here.</p>
        </section>
      </main>
    </div>
  )
}
