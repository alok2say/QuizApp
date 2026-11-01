import Link from 'next/link'
import type { AdminQuizListItem } from '@/lib/quiz/queries'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, Page, PageHeader } from '@/ui'
import { DeleteQuizButton } from './DeleteQuizButton'

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function AdminQuizListView({ quizzes }: { quizzes: AdminQuizListItem[] }) {
  return (
    <Page>
      <PageHeader
        title="Manage quizzes"
        action={
          <Link href="/admin/quizzes/new" className={buttonVariants()}>
            New quiz
          </Link>
        }
      />

      {quizzes.length === 0 && <EmptyState>No quizzes yet. Create the first one.</EmptyState>}

      {quizzes.length > 0 && (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Title</TableHead>
                  <TableHead className="text-right">Questions</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quizzes.map((quiz) => (
                  <TableRow key={quiz.id}>
                    <TableCell className="pl-4 font-medium whitespace-normal">{quiz.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{quiz.questionCount}</TableCell>
                    <TableCell className="text-muted-foreground">{dateFormat.format(quiz.createdAt)}</TableCell>
                    <TableCell className="pr-4">
                      <div className="flex items-start justify-end gap-1">
                        <Link
                          href={`/admin/quizzes/${quiz.id}/edit`}
                          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                        >
                          Edit
                        </Link>
                        <DeleteQuizButton quizId={quiz.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Page>
  )
}
