import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { getLeaderboard } from '@/lib/quiz/queries'
import { formatDuration } from '@/lib/format'
import { StartQuizButton } from '../../StartQuizButton'
import controls from '../../controls.module.css'
import styles from './leaderboard.module.css'

function timeLabel(seconds: number | null) {
  return seconds === null ? '—' : formatDuration(seconds)
}

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

  const empty = result.top.length === 0

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>{result.quizTitle} leaderboard</h1>
        <p className={styles.intro}>Best attempt per person. Ties go to the faster time.</p>

        {empty && <p className={styles.message}>No one has finished this quiz yet.</p>}

        {!empty && (
          <table className={styles.board}>
            <thead className={styles.srOnly}>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Name</th>
                <th scope="col">Score</th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              {result.top.map((entry, index) => {
                const isYou = entry.userId === user.id

                return (
                  <tr key={entry.userId} className={isYou ? styles.you : undefined}>
                    <td className={styles.rank}>{index + 1}</td>
                    <td className={styles.name}>{isYou ? 'You' : entry.displayName}</td>
                    <td className={styles.score}>
                      {entry.score}
                      <span className={styles.outOf}> / {result.maxScore}</span>
                    </td>
                    <td className={styles.time}>{timeLabel(entry.completionSeconds)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* only present when the viewer isn't already visible in the board above */}
        {result.ownRank && (
          <p className={styles.ownRank}>
            Your best: {result.ownRank.score} / {result.maxScore} in{' '}
            {timeLabel(result.ownRank.completionSeconds)}, outside the top {result.top.length}
          </p>
        )}

        {!result.hasAttempted && (
          <div className={styles.cta}>
            {!empty && <p className={styles.message}>You haven&apos;t taken this quiz yet.</p>}
            <StartQuizButton quizId={quizId} label="Take the quiz" className={controls.primary} />
          </div>
        )}
      </main>
    </div>
  )
}
