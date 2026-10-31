// The only source of library documents. Today these are PDFs shipped in
// public/pdfs; when server downloads arrive, only these two functions change
// (to a DB/API read) and `src` becomes a server URL.

export type LibraryDocument = {
  slug: string
  title: string
  description: string
  pageCount: number
  src: string
}

const DOCUMENTS: LibraryDocument[] = [
  {
    slug: 'cardiology-chap-2',
    title: 'Cardiology, chapter 2',
    description: 'A short chapter from a cardiology textbook.',
    pageCount: 8,
    src: '/pdfs/cardiology-chap-2.pdf',
  },
  {
    slug: 'cardio-algo',
    title: 'Cardiology algorithms',
    description: 'Step-by-step clinical algorithms for common cardiac presentations.',
    pageCount: 22,
    src: '/pdfs/cardio-algo.pdf',
  },
]

export function getDocuments(): LibraryDocument[] {
  return DOCUMENTS
}

export function getDocument(slug: string): LibraryDocument | null {
  return DOCUMENTS.find((doc) => doc.slug === slug) ?? null
}
