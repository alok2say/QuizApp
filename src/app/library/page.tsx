import Link from 'next/link'
import { getDocuments } from '@/lib/library/catalog'
import controls from '@/app/controls.module.css'
import styles from './library.module.css'

export default function LibraryPage() {
  const documents = getDocuments()

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Library</h1>
        <p className={styles.intro}>PDFs you can read right here in the app.</p>

        {documents.length === 0 && <p className={styles.empty}>No documents yet.</p>}

        {documents.length > 0 && (
          <ul className={styles.list}>
            {documents.map((doc) => (
              <li key={doc.slug} className={styles.row}>
                <div>
                  <h2 className={styles.docTitle}>{doc.title}</h2>
                  <p className={styles.description}>{doc.description}</p>
                  <p className={styles.meta}>
                    {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                  </p>
                </div>
                <Link className={controls.secondary} href={`/library/${doc.slug}`}>Read</Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
