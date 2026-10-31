import type { Metadata } from 'next'
import { DesignCatalog } from '@/features/design/DesignCatalog'

export const metadata: Metadata = { title: 'Design system · DemoQuizApp' }

// Not linked from the header: a reference page for checking a design change
export default function DesignPage() {
  return <DesignCatalog />
}
