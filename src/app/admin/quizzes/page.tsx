import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getAllQuizzesForAdmin } from '@/lib/quiz/queries'
import { DeleteQuizButton } from './DeleteQuizButton'

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
    <main>
      <h1>Admin: Quizzes</h1>
      <Link href="/admin/quizzes/new">New Quiz</Link>
      <ul>
        {quizzes.map((quiz) => (
          <li key={quiz.id}>
            <span>{quiz.title}</span>
            <span>
              {' '}
              — {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
            </span>
            <Link href={`/admin/quizzes/${quiz.id}/edit`}>Edit</Link>
            <DeleteQuizButton quizId={quiz.id} />
          </li>
        ))}
      </ul>
    </main>
  )
}
