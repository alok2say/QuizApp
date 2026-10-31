'use client'

import { useEffect, useRef } from 'react'
import { PDFViewer, type PluginRegistry } from '@embedpdf/react-pdf-viewer'

export function PdfViewer({ src }: { src: string }) {
  const registryRef = useRef<PluginRegistry | null>(null)

  // The library's React wrapper only clears its DOM on unmount, leaving the
  // PDFium workers running (6 per document). Tear the registry and engine
  // down ourselves so moving between documents doesn't pile up workers.
  useEffect(() => {
    return () => {
      const registry = registryRef.current
      if (!registry) return
      const engine = registry.getEngine()
      void registry.destroy().finally(() => engine.destroy?.())
    }
  }, [])

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
      onReady={(registry) => {
        registryRef.current = registry
      }}
      // pinned to the frame's edges: a percentage height can't resolve inside the min-height flex chain
      style={{ position: 'absolute', inset: 0 }}
    />
  )
}
