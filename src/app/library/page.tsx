import { getDocuments } from '@/lib/library/catalog'
import { LibraryListView } from '@/features/library/LibraryListView'

export default function LibraryPage() {
  return <LibraryListView documents={getDocuments()} />
}
