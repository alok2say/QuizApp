import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import styles from '../admin.module.css'
import { QuizJsonEditor } from '../QuizJsonEditor'

// starter template — gives the admin a working example instead of a blank box
const TEMPLATE = JSON.stringify(
  {
    title: 'New Quiz',
    description: '',
    timeLimitSeconds: 300,
    retakePolicy: 'UNLIMITED_BEST',
    feedbackMode: 'END_ONLY',
    questions: [
      {
        text: 'Sample question?',
        type: 'SINGLE_SELECT',
        points: 10,
        options: [
          { text: 'Correct answer', isCorrect: true },
          { text: 'Wrong answer', isCorrect: false },
        ],
      },
    ],
  },
  null,
  2,
)

export default async function NewQuizPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  if (user.role !== 'ADMIN') {
    notFound()
  }

  return (
    <div className={styles.page}>
      <main className={`${styles.main} ${styles.wide}`}>
        <h1 className={styles.title}>New quiz</h1>
        <QuizJsonEditor initialJson={TEMPLATE} submitUrl="/api/admin/quizzes" method="POST" />
      </main>
    </div>
  )
}
