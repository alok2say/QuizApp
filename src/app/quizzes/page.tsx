import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getQuizzesWithStatus } from '@/lib/quiz/queries'
import { QuizListView } from '@/features/quizzes/QuizListView'

export default async function QuizzesPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  return <QuizListView quizzes={await getQuizzesWithStatus(user.id)} />
}
