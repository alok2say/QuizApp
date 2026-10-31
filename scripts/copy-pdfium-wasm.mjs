// Copies the PDFium WebAssembly binary into public/ so the PDF viewer loads it
// from this app instead of the jsdelivr CDN. Runs on every `npm install`, so the
// copy always matches the installed @embedpdf/pdfium version.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'

const source = 'node_modules/@embedpdf/pdfium/dist/pdfium.wasm'
const targetDir = 'public/pdfium'

if (!existsSync(source)) {
  console.error(`copy-pdfium-wasm: ${source} not found. Is @embedpdf/pdfium installed?`)
  process.exit(1)
}

mkdirSync(targetDir, { recursive: true })
copyFileSync(source, `${targetDir}/pdfium.wasm`)
console.log(`copy-pdfium-wasm: copied ${source} -> ${targetDir}/pdfium.wasm`)
