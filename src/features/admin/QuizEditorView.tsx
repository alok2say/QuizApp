import { Page, PageHeader } from '@/ui'
import { QuizJsonEditor } from './QuizJsonEditor'

// New and edit share this screen; the editor needs the wide column for long JSON lines
export function QuizEditorView({
  heading,
  initialJson,
  submitUrl,
  method,
}: {
  heading: React.ReactNode
  initialJson: string
  submitUrl: string
  method: 'POST' | 'PUT'
}) {
  return (
    <Page width="wide">
      <PageHeader title={heading} />
      <QuizJsonEditor initialJson={initialJson} submitUrl={submitUrl} method={method} />
    </Page>
  )
}
