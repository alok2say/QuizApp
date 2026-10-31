import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDocument } from '@/lib/library/catalog'
import { PdfReader } from '@alok2say/pdf-reader/react'
import styles from './viewer.module.css'

export default async function LibraryDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const doc = getDocument(slug)
  if (!doc) {
    notFound()
  }

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <Link className={styles.back} href="/library">Library</Link>
        <h1 className={styles.title}>{doc.title}</h1>
      </div>
      <div className={styles.frame}>
        {/* keyed so moving between documents re-initializes the viewer */}
        <PdfReader key={doc.slug} src={doc.src} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </div>
  )
}
