import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getLeaderboard } from '@/lib/quiz/queries'

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

  return (
    <main>
      <h1>{result.quizTitle} — Leaderboard</h1>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Score</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {result.top.map((entry, index) => (
            <tr key={entry.userId}>
              <td>{index + 1}</td>
              <td>{entry.displayName}</td>
              <td>
                {entry.score} / {result.maxScore}
              </td>
              <td>{entry.completionSeconds ?? '—'}s</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* only rendered when the caller isn't already visible in the table above */}
      {result.ownRank && (
        <p>
          Your rank: {result.ownRank.score} / {result.maxScore}
        </p>
      )}

      {!result.hasAttempted && (
        <p>
          You haven&apos;t attempted this quiz yet. <Link href="/quizzes">Take it now</Link>
        </p>
      )}
    </main>
  )
}
