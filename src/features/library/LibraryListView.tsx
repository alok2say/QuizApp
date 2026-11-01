import Link from 'next/link'
import type { LibraryDocument } from '@/lib/library/catalog'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, Page, PageHeader } from '@/ui'

export function LibraryListView({ documents }: { documents: LibraryDocument[] }) {
  return (
    <Page>
      <PageHeader title="Library" description="PDFs you can read right here in the app." />

      {documents.length === 0 && <EmptyState>No documents yet.</EmptyState>}

      {documents.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {documents.map((doc) => (
            <li key={doc.slug}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    <h2>{doc.title}</h2>
                  </CardTitle>
                  <CardDescription>{doc.description}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto justify-between gap-2">
                  <Badge variant="secondary">
                    {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                  </Badge>
                  <Link
                    href={`/library/${doc.slug}`}
                    aria-label={`Read ${doc.title}`}
                    className={buttonVariants({ variant: 'outline' })}
                  >
                    Read
                  </Link>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
