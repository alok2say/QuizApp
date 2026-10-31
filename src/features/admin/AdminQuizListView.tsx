import type { AdminQuizListItem } from '@/lib/quiz/queries'
import { ButtonLink, EmptyState, Heading, List, ListRow, Meta, Page, PageHeader, TextLink } from '@/ui'
import { DeleteQuizButton } from './DeleteQuizButton'
import styles from './AdminQuizListView.module.css'

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function AdminQuizListView({ quizzes }: { quizzes: AdminQuizListItem[] }) {
  return (
    <Page>
      <PageHeader title="Manage quizzes" action={<ButtonLink href="/admin/quizzes/new">New quiz</ButtonLink>} />

      {quizzes.length === 0 && <EmptyState>No quizzes yet. Create the first one.</EmptyState>}

      {quizzes.length > 0 && (
        <List>
          {quizzes.map((quiz) => (
            <ListRow key={quiz.id} density="compact" align="baseline">
              <div>
                <Heading>{quiz.title}</Heading>
                <Meta spacing="tight">
                  {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}, added{' '}
                  {dateFormat.format(quiz.createdAt)}
                </Meta>
              </div>
              <div className={styles.rowActions}>
                <TextLink href={`/admin/quizzes/${quiz.id}/edit`}>Edit</TextLink>
                <DeleteQuizButton quizId={quiz.id} />
              </div>
            </ListRow>
          ))}
        </List>
      )}
    </Page>
  )
}
