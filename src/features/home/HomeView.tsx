import { Actions, ButtonLink, Heading, Page, PageHeader, TextLink } from '@/ui'
import styles from './HomeView.module.css'

export function HomeView({ signedIn }: { signedIn: boolean }) {
  return (
    <Page>
      <PageHeader title="DemoQuizApp" description="Take a quiz and see where you rank." />

      <nav aria-label="Main">
        <Actions gap="loose" spacing="loose">
          {signedIn ? (
            <ButtonLink href="/quizzes">Browse quizzes</ButtonLink>
          ) : (
            <ButtonLink href="/login">Log in</ButtonLink>
          )}
        </Actions>
      </nav>

      <section className={styles.books} aria-labelledby="books">
        <Heading id="books">Books</Heading>
        <p className={styles.text}>Read the documents in the library.</p>
        <div className={styles.more}>
          <TextLink href="/library">Browse the library</TextLink>
        </div>
      </section>

      <section className={styles.placeholder} aria-labelledby="events">
        <Heading id="events">Events</Heading>
        <p className={styles.text}>Meetups will show up here.</p>
      </section>
    </Page>
  )
}
