import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PdfReader } from '@alok2say/pdf-reader/react'
import type { LibraryDocument } from '@/lib/library/catalog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Full-width reader under a narrow heading; doesn't use Page because the
// viewer fills the rest of the window
export function DocumentView({ doc }: { doc: LibraryDocument }) {
  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-4">
        <Link href="/library" className={cn(buttonVariants({ variant: 'link' }), 'px-0 text-muted-foreground')}>
          <ChevronLeft />
          Library
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{doc.title}</h1>
      </div>
      <div className="relative min-h-96 flex-1 border-t">
        {/* keyed so moving between documents re-initializes the viewer */}
        <PdfReader key={doc.slug} src={doc.src} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </main>
  )
}
