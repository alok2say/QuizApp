import type { LeaderboardResult } from '@/lib/quiz/queries'
import { formatDuration } from '@/lib/format'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { EmptyState, Page, PageHeader } from '@/ui'
import { StartQuizButton } from '@/features/quizzes/StartQuizButton'

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
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 pl-4">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="pr-4 text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="tabular-nums">
                {board.top.map((entry, index) => {
                  const isYou = entry.userId === viewerId
                  return (
                    <TableRow key={entry.userId} className={cn(isYou && 'bg-muted font-medium')}>
                      <TableCell className="pl-4 font-semibold">{index + 1}</TableCell>
                      <TableCell className="whitespace-normal">{isYou ? 'You' : entry.displayName}</TableCell>
                      <TableCell className="text-right">
                        {entry.score}
                        <span className="text-muted-foreground"> / {board.maxScore}</span>
                      </TableCell>
                      <TableCell className="pr-4 text-right text-muted-foreground">
                        {timeLabel(entry.completionSeconds)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* only present when the viewer isn't already visible in the board above */}
      {board.ownRank && (
        <Alert role="status" className="mt-6">
          <AlertDescription>
            {`Your best: ${board.ownRank.score} / ${board.maxScore} in ${timeLabel(board.ownRank.completionSeconds)}, outside the top ${board.top.length}`}
          </AlertDescription>
        </Alert>
      )}

      {!board.hasAttempted && (
        <div className="mt-6 space-y-4">
          {!empty && <p className="text-muted-foreground">You haven&apos;t taken this quiz yet.</p>}
          <StartQuizButton quizId={quizId} label="Take the quiz" />
        </div>
      )}
    </Page>
  )
}
