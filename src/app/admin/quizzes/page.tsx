import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getAllQuizzesForAdmin } from '@/lib/quiz/queries'
import { DeleteQuizButton } from './DeleteQuizButton'
import controls from '@/app/controls.module.css'
import styles from './admin.module.css'

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default async function AdminQuizzesPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  // belt-and-suspenders: middleware already blocks non-admins on /admin/*
  if (user.role !== 'ADMIN') {
    notFound()
  }

  const quizzes = await getAllQuizzesForAdmin()

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.head}>
          <h1 className={styles.title}>Manage quizzes</h1>
          <Link className={controls.primary} href="/admin/quizzes/new">New quiz</Link>
        </div>

        {quizzes.length === 0 && <p className={styles.empty}>No quizzes yet. Create the first one.</p>}

        {quizzes.length > 0 && (
          <ul className={styles.list}>
            {quizzes.map((quiz) => (
              <li key={quiz.id} className={styles.row}>
                <div>
                  <h2 className={styles.quizTitle}>{quiz.title}</h2>
                  <p className={styles.meta}>
                    {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}, added{' '}
                    {dateFormat.format(quiz.createdAt)}
                  </p>
                </div>
                <div className={styles.rowActions}>
                  <Link className={styles.textLink} href={`/admin/quizzes/${quiz.id}/edit`}>Edit</Link>
                  <DeleteQuizButton quizId={quiz.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
