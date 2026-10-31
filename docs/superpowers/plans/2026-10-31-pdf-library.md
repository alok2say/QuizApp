# PDF Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone browse a list of PDFs shipped with the app and read
each one in an in-app viewer.

**Architecture:** A typed in-code catalog (`src/lib/library/catalog.ts`)
is the only source of documents; two server pages (`/library`,
`/library/[slug]`) read from it. The viewer is `@embedpdf/react-pdf-viewer`
inside a client-only wrapper loaded with `next/dynamic({ ssr: false })`,
using a self-hosted `pdfium.wasm` copied into `public/` at install time.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2, TypeScript,
CSS modules, Vitest, `@embedpdf/react-pdf-viewer` 2.1.0.

**Spec:** `SPEC.md` → "PDF Library" (read it alongside this plan).

## Global Constraints

- Library version pinned exactly: `@embedpdf/react-pdf-viewer@2.1.0` and `@embedpdf/pdfium@2.1.0`.
- `/library` and `/library/[slug]` are public; do **not** add them to the middleware matcher.
- Pages read documents only via `getDocuments()` / `getDocument(slug)`; no page imports the raw list.
- Viewer config: `wasmUrl: '/pdfium/pdfium.wasm'`, `disabledCategories: ['annotation', 'redaction', 'panel-comment']`, `theme: { preference: 'system' }`.
- `ssr: false` must live in a `'use client'` file (Next 16 rejects it in Server Components).
- `public/pdfium/` is git-ignored; the wasm is produced by `postinstall`, never committed.
- Styling uses existing tokens (`--ink`, `--paper`, `--muted`, `--answer`, `--rule`) and `@/app/controls.module.css`; copy is sentence case.
- Every task ends with `npx vitest run`, `npx tsc --noEmit`, `npx eslint .` all clean.
- No file picker / local-device upload in this plan (deferred by the user).

## Review Focus

1. **Catalog entry whose PDF file is missing** — expect a failing unit test, not a blank viewer in production. Pinned in Task 1 (`every document's file exists in public/`).
2. **Crafted or unknown slug** (`../SPEC.md`, `CARDIOLOGY-CHAP-2`, empty) — expect 404, never a file read. Pinned in Task 1 (`getDocument returns null…`) and Task 3 browser check.
3. **`postinstall` didn't run / wasm missing** — expect `/pdfium/pdfium.wasm` → 200 after `npm install`; the browser check fails loudly if the viewer falls back to jsdelivr. Pinned in Task 3 Steps 3 and 8.
4. **Switching documents via client navigation** — expect the second PDF to render, not the first one cached in the viewer. Pinned in Task 3 browser check (`key={doc.slug}`).
5. **Large PDF (4.8 MB, 22 pages) on a phone-width screen** — expect it to render and scroll with no horizontal page overflow. Pinned in Task 3 browser check.

---

### Task 1: Catalog and starter PDFs

**Files:**
- Create: `src/lib/library/catalog.ts`
- Test: `src/lib/library/catalog.test.ts`
- Add: `public/pdfs/cardiology-chap-2.pdf`, `public/pdfs/cardio-algo.pdf`

**Interfaces:**
- Produces:
  - `type LibraryDocument = { slug: string; title: string; description: string; pageCount: number; src: string }`
  - `getDocuments(): LibraryDocument[]` — catalog order
  - `getDocument(slug: string): LibraryDocument | null` — exact match

- [ ] **Step 1: Copy the PDFs** (lower-case file names so slug = file name)

```bash
mkdir -p public/pdfs
cp "/Users/alranjan/Source Code/FullStack Learnings/PdfViewer1/EmbedPdfViewer/public/Cardiology-Chap-2.pdf" public/pdfs/cardiology-chap-2.pdf
cp "/Users/alranjan/Source Code/FullStack Learnings/PdfViewer1/EmbedPdfViewer/public/cardio-algo.pdf" public/pdfs/cardio-algo.pdf
```

- [ ] **Step 2: Write the failing tests** in `catalog.test.ts`

```ts
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
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run src/lib/library/catalog.test.ts` → FAIL "Cannot find module './catalog'".

- [ ] **Step 4: Implement `catalog.ts`.** A `const DOCUMENTS: LibraryDocument[]` with the two entries (titles "Cardiology, chapter 2" and "Cardiology algorithms"; one-line plain descriptions); `getDocuments` returns it, `getDocument` uses `find` on `slug ===`. Comment the file as the seam that becomes a DB/API read when server downloads arrive.

- [ ] **Step 5: Run to verify pass** — same command → 5 passed. Then the three gate commands.

- [ ] **Step 6: Commit**

```bash
git add public/pdfs src/lib/library
git commit -m "feat: add PDF library catalog with starter documents"
```

---

### Task 2: Library list page, header link, Home "Books"

**Files:**
- Create: `src/app/library/page.tsx`, `src/app/library/library.module.css`
- Modify: `src/app/SiteHeader.tsx`, `src/app/page.tsx`, `src/app/page.module.css`

**Interfaces:**
- Consumes: `getDocuments()` from Task 1; `NavLink` (`src/app/NavLink.tsx`); `controls.primary/secondary`.
- Produces: route `/library` linking each row to `/library/${slug}`.

- [ ] **Step 1: `/library` page** — server component, no auth. Heading "Library", intro "PDFs you can read right here in the app.", ruled list (same structure/spacing as `/quizzes`: 44rem column, `--rule` borders): title (h2), description, meta "N pages", and a `controls.secondary` link "Read". Empty state: "No documents yet."

- [ ] **Step 2: Header link** — add `<NavLink className={styles.link} href="/library">Library</NavLink>` as the first nav item in **both** the logged-in and logged-out branches.

- [ ] **Step 3: Home "Books"** — replace the single "Books and events" placeholder with two sections: "Books" (text "Read the documents in the library." + link "Browse the library" → `/library`, styled like the existing `.link`/primary pattern on Home — not dashed) and "Events" (keeps the dashed placeholder, "Meetups will show up here.").

- [ ] **Step 4: Verify in the browser** (dev server on :3000): `/library` lists both documents with "8 pages" / "22 pages"; header shows "Library" active on `/library`, logged out and logged in; Home shows the Books link; light, dark, and 360px width with no horizontal overflow. Then the three gate commands.

- [ ] **Step 5: Commit**

```bash
git add src/app/library src/app/SiteHeader.tsx src/app/page.tsx src/app/page.module.css
git commit -m "feat: add library page, header link, and Home books section"
```

---

### Task 3: Viewer page with self-hosted PDFium

**Files:**
- Modify: `package.json` (deps + `postinstall`), `.gitignore`
- Create: `scripts/copy-pdfium-wasm.mjs`
- Create: `src/app/library/[slug]/PdfViewer.tsx`, `src/app/library/[slug]/PdfViewerLoader.tsx`, `src/app/library/[slug]/page.tsx`, `src/app/library/[slug]/viewer.module.css`
- Modify: `docs/NAVIGATION.md`, `docs/LEARNING_LOG.md`, `CONTEXT.md`, `SPEC.md` (mark implemented)

**Interfaces:**
- Consumes: `getDocument(slug)` from Task 1.
- Produces: `PdfViewer({ src }: { src: string })` (client, imports `PDFViewer` from the library); `PdfViewerLoader({ src }: { src: string })` (client, `dynamic(() => import('./PdfViewer').then(m => m.PdfViewer), { ssr: false, loading: () => <p>Loading the document…</p> })`).

- [ ] **Step 1: Install pinned deps** — `npm install @embedpdf/react-pdf-viewer@2.1.0 @embedpdf/pdfium@2.1.0` (explicit `pdfium` dep so its path in `node_modules` is guaranteed).

- [ ] **Step 2: Copy script** — `scripts/copy-pdfium-wasm.mjs` copies `node_modules/@embedpdf/pdfium/dist/pdfium.wasm` → `public/pdfium/pdfium.wasm` (create the dir; exit non-zero with a clear message if the source is missing). Add `"postinstall": "node scripts/copy-pdfium-wasm.mjs"` to `package.json` and `/public/pdfium/` to `.gitignore`.

- [ ] **Step 3: Verify the copy** — `npm install` then `ls -la public/pdfium/pdfium.wasm` (≈7.7 MB) and `git status --short public/pdfium` prints nothing.

- [ ] **Step 4: Viewer components** — `PdfViewer` renders `<PDFViewer config={{ src, wasmUrl: '/pdfium/pdfium.wasm', disabledCategories: ['annotation', 'redaction', 'panel-comment'], theme: { preference: 'system' } }} style={{ width: '100%', height: '100%' }} />`. `PdfViewerLoader` as in Interfaces.

- [ ] **Step 5: `/library/[slug]` page** — server component; `params: Promise<{ slug: string }>` (await it); `getDocument(slug)` → `notFound()` if null. Layout: small "Library" back link, h1 title, then a viewer frame `<div className={styles.frame}><PdfViewerLoader key={doc.slug} src={doc.src} /></div>`. CSS: page is a flex column filling the space under the header; `.frame { flex: 1; min-height: 32rem; border-top: 1px solid var(--rule) }`, full content width (no 44rem cap on the frame).

- [ ] **Step 6: Gates** — `npx vitest run`, `npx tsc --noEmit`, `npx eslint .` clean.

- [ ] **Step 7: Browser check (headless Chromium)** —
  - `/library/cardiology-chap-2` and `/library/cardio-algo` both render pages (screenshot shows PDF content, not a blank frame); page 22 reachable in the large one.
  - Search box finds a word visible on page 1; zoom in/out works.
  - Network log: `/pdfium/pdfium.wasm` → 200; **no** request to `cdn.jsdelivr.net/npm/@embedpdf/pdfium`.
  - From `/library`, click doc 1 → back → click doc 2: doc 2's content shows.
  - `/library/nope` and `/library/..%2FSPEC.md` → 404.
  - Dark mode: viewer chrome is dark; 360px width: no horizontal page overflow.
  - No console errors besides expected 404s.

- [ ] **Step 8: Docs** — `SPEC.md` PDF Library: add "Implemented in `<sha>`, verified …"; `docs/NAVIGATION.md`: add both routes to the page table and map; `docs/LEARNING_LOG.md`: entry covering `ssr: false` in a client wrapper, self-hosted wasm via `postinstall`, catalog seam, `key` re-init; `CONTEXT.md`: status + next steps (server-downloaded PDFs, deferred file picker).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore scripts src/app/library
git commit -m "feat: add in-app PDF viewer with self-hosted PDFium"
git add SPEC.md CONTEXT.md docs
git commit -m "docs: record PDF library implementation"
```
