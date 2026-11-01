import { PdfReader } from '@alok2say/pdf-reader/react'
import type { LibraryDocument } from '@/lib/library/catalog'
import { PageHeader, TextLink } from '@/ui'
import styles from './DocumentView.module.css'

// Full-width reader under a narrow heading; doesn't use Page because the
// viewer fills the rest of the window
export function DocumentView({ doc }: { doc: LibraryDocument }) {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <TextLink href="/library" tone="muted">Library</TextLink>
        <div className={styles.title}>
          <PageHeader title={doc.title} />
        </div>
      </div>
      <div className={styles.frame}>
        {/* keyed so moving between documents re-initializes the viewer */}
        <PdfReader key={doc.slug} src={doc.src} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </div>
  )
}
