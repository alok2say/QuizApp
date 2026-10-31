import { notFound } from 'next/navigation'
import { getDocument } from '@/lib/library/catalog'
import { DocumentView } from '@/features/library/DocumentView'

export default async function LibraryDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = getDocument(slug)
  if (!doc) {
    notFound()
  }

  return <DocumentView doc={doc} />
}
