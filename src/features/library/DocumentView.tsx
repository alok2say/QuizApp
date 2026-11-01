import { PdfReader } from '@alok2say/pdf-reader/react'
import type { LibraryDocument } from '@/lib/library/catalog'

// The reader fills the whole window under the site header. The title stays
// as a screen-reader-only heading; the header's Library link leads back.
export function DocumentView({ doc }: { doc: LibraryDocument }) {
  return (
    <main className="flex flex-1 flex-col">
      <h1 className="sr-only">{doc.title}</h1>
      <div className="relative min-h-96 flex-1">
        {/* keyed so moving between documents re-initializes the viewer */}
        <PdfReader key={doc.slug} src={doc.src} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </main>
  )
}
