import type { LeaderboardResult } from '@/lib/quiz/queries'
import { formatDuration } from '@/lib/format'
import { EmptyState, Notice, Page, PageHeader, VisuallyHidden } from '@/ui'
import { StartQuizButton } from '@/features/quizzes/StartQuizButton'
import styles from './LeaderboardView.module.css'

type Board = Extract<LeaderboardResult, { ok: true }>

function timeLabel(seconds: number | null) {
  return seconds === null ? '—' : formatDuration(seconds)
}

export function LeaderboardView({ board, viewerId, quizId }: { board: Board; viewerId: string; quizId: string }) {
  const empty = board.top.length === 0

  return (
    <Page>
      <PageHeader
        title={`${board.quizTitle} leaderboard`}
        description="Best attempt per person. Ties go to the faster time."
      />

      {empty && <EmptyState>No one has finished this quiz yet.</EmptyState>}

      {!empty && (
        <table className={styles.board}>
          <VisuallyHidden as="thead">
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Name</th>
              <th scope="col">Score</th>
              <th scope="col">Time</th>
            </tr>
          </VisuallyHidden>
          <tbody>
            {board.top.map((entry, index) => {
              const isYou = entry.userId === viewerId

              return (
                <tr key={entry.userId} className={isYou ? styles.you : undefined}>
                  <td className={styles.rank}>{index + 1}</td>
                  <td className={styles.name}>{isYou ? 'You' : entry.displayName}</td>
                  <td className={styles.score}>
                    {entry.score}
                    <span className={styles.outOf}> / {board.maxScore}</span>
                  </td>
                  <td className={styles.time}>{timeLabel(entry.completionSeconds)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* only present when the viewer isn't already visible in the board above */}
      {board.ownRank && (
        <Notice tone="accent">
          Your best: {board.ownRank.score} / {board.maxScore} in{' '}
          {timeLabel(board.ownRank.completionSeconds)}, outside the top {board.top.length}
        </Notice>
      )}

      {!board.hasAttempted && (
        <div className={styles.cta}>
          {!empty && <p className={styles.ctaMessage}>You haven&apos;t taken this quiz yet.</p>}
          <StartQuizButton quizId={quizId} label="Take the quiz" />
        </div>
      )}
    </Page>
  )
}
