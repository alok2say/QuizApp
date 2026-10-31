import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getLeaderboard } from '@/lib/quiz/queries'
import { LeaderboardView } from '@/features/attempt/LeaderboardView'

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ quizId: string }>
}) {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const { quizId } = await params
  const result = await getLeaderboard(quizId, user.id)

  if (!result.ok) {
    notFound()
  }

  return <LeaderboardView board={result} viewerId={user.id} quizId={quizId} />
}
