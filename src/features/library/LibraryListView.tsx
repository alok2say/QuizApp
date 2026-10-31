import type { LibraryDocument } from '@/lib/library/catalog'
import { ButtonLink, Description, EmptyState, Heading, List, ListRow, Meta, Page, PageHeader } from '@/ui'

export function LibraryListView({ documents }: { documents: LibraryDocument[] }) {
  return (
    <Page>
      <PageHeader title="Library" intro="PDFs you can read right here in the app." />

      {documents.length === 0 && <EmptyState>No documents yet.</EmptyState>}

      {documents.length > 0 && (
        <List>
          {documents.map((doc) => (
            <ListRow key={doc.slug}>
              <div>
                <Heading>{doc.title}</Heading>
                <Description>{doc.description}</Description>
                <Meta tabular>
                  {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                </Meta>
              </div>
              <ButtonLink variant="secondary" href={`/library/${doc.slug}`}>Read</ButtonLink>
            </ListRow>
          ))}
        </List>
      )}
    </Page>
  )
}
