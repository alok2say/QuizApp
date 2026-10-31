import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getAllQuizzesForAdmin } from '@/lib/quiz/queries'
import { AdminQuizListView } from '@/features/admin/AdminQuizListView'

export default async function AdminQuizzesPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }
  // belt-and-suspenders: middleware already blocks non-admins on /admin/*
  if (user.role !== 'ADMIN') {
    notFound()
  }

  return <AdminQuizListView quizzes={await getAllQuizzesForAdmin()} />
}
