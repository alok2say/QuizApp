'use client'

import dynamic from 'next/dynamic'
import styles from './viewer.module.css'

// The viewer uses WebAssembly and browser-only APIs, so it never renders on the
// server. Next 16 only allows `ssr: false` inside a Client Component like this one.
export const PdfViewerLoader = dynamic(() => import('./PdfViewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <p className={styles.loading}>Loading the document…</p>,
})
