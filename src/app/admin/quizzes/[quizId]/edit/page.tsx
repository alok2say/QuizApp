import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getQuizAsJson } from '@/lib/quiz/queries'
import styles from '../../admin.module.css'
import { QuizJsonEditor } from '../../QuizJsonEditor'

export default async function EditQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  if (user.role !== 'ADMIN') {
    notFound()
  }

  const { quizId } = await params
  const quizJson = await getQuizAsJson(quizId)
  if (!quizJson) {
    // distinct from the role check above — this one means the quizId itself doesn't exist
    notFound()
  }

  return (
    <div className={styles.page}>
      <main className={`${styles.main} ${styles.wide}`}>
        <h1 className={styles.title}>Edit &ldquo;{quizJson.title}&rdquo;</h1>
        <QuizJsonEditor
          initialJson={JSON.stringify(quizJson, null, 2)}
          submitUrl={`/api/admin/quizzes/${quizId}`}
          method="PUT"
        />
      </main>
    </div>
  )
}
