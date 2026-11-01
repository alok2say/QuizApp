import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Page, PageHeader } from '@/ui'

export function HomeView({ signedIn }: { signedIn: boolean }) {
  return (
    <Page>
      <PageHeader title="DemoQuizApp" description="Take a quiz and see where you rank." />

      <nav aria-label="Main">
        {signedIn ? (
          <Link href="/quizzes" className={buttonVariants({ size: 'lg' })}>
            Browse quizzes
          </Link>
        ) : (
          <Link href="/login" className={buttonVariants({ size: 'lg' })}>
            Log in
          </Link>
        )}
      </nav>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="books">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>
                <h2 id="books">Books</h2>
              </CardTitle>
              <CardDescription>Read the documents in the library.</CardDescription>
            </CardHeader>
            <CardFooter className="mt-auto">
              <Link href="/library" className={buttonVariants({ variant: 'outline' })}>
                Browse the library
              </Link>
            </CardFooter>
          </Card>
        </section>

        <section aria-labelledby="events">
          {/* no events yet: a dashed card marks the space */}
          <Card className="h-full border border-dashed ring-0">
            <CardHeader>
              <CardTitle>
                <h2 id="events">Events</h2>
              </CardTitle>
              <CardDescription>Meetups will show up here.</CardDescription>
            </CardHeader>
          </Card>
        </section>
      </div>
    </Page>
  )
}
