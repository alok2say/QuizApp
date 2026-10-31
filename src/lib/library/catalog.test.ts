import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { getDocuments, getDocument } from './catalog'

describe('library catalog', () => {
  it('lists the starter documents in catalog order', () => {
    expect(getDocuments().map((d) => d.slug)).toEqual(['cardiology-chap-2', 'cardio-algo'])
    expect(getDocuments()[0]).toMatchObject({ pageCount: 8, src: '/pdfs/cardiology-chap-2.pdf' })
    expect(getDocuments()[1]).toMatchObject({ pageCount: 22, src: '/pdfs/cardio-algo.pdf' })
  })

  it('finds a document by exact slug', () => {
    expect(getDocument('cardio-algo')?.title).toBeTruthy()
  })

  it('returns null for unknown or crafted slugs', () => {
    for (const slug of ['nope', '', 'CARDIO-ALGO', '../SPEC.md', 'pdfs/cardio-algo']) {
      expect(getDocument(slug)).toBeNull()
    }
  })

  it("every document's file exists in public/", () => {
    for (const d of getDocuments()) {
      expect(existsSync(path.join(process.cwd(), 'public', d.src))).toBe(true)
    }
  })

  it('has unique slugs', () => {
    const slugs = getDocuments().map((d) => d.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
