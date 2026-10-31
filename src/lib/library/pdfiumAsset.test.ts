import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// The viewer hangs on "Loading…" (no error) if public/pdfium/pdfium.wasm is
// missing, e.g. after `npm ci --ignore-scripts`. These checks make that loud.
describe('self-hosted PDFium wasm', () => {
  const copy = 'node scripts/copy-pdfium-wasm.mjs'
  const scripts = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).scripts

  it('is copied before dev and build, not only on install', () => {
    expect(scripts.postinstall).toBe(copy)
    expect(scripts.predev).toBe(copy)
    expect(scripts.prebuild).toBe(copy)
  })

  it('exists in public/ where the viewer loads it from', () => {
    expect(existsSync(path.join(process.cwd(), 'public', 'pdfium', 'pdfium.wasm'))).toBe(true)
  })
})
