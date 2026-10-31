'use client'

import { PDFViewer } from '@embedpdf/react-pdf-viewer'

export function PdfViewer({ src }: { src: string }) {
  return (
    <PDFViewer
      config={{
        src,
        // Served from public/ by scripts/copy-pdfium-wasm.mjs instead of the jsdelivr CDN.
        // Must be absolute: the engine runs in a blob: worker, where "/pdfium/..." can't resolve.
        wasmUrl: new URL('/pdfium/pdfium.wasm', window.location.origin).href,
        disabledCategories: ['annotation', 'redaction', 'panel-comment'],
        theme: { preference: 'system' },
      }}
      // pinned to the frame's edges: a percentage height can't resolve inside the min-height flex chain
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
