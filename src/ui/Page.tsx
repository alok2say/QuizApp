import { cn } from '@/lib/utils'

const WIDTH = {
  narrow: 'max-w-sm',
  default: 'max-w-3xl',
  wide: 'max-w-5xl',
}

// The page shell: a centered column with the standard gutters
export function Page({ width = 'default', children }: { width?: keyof typeof WIDTH; children: React.ReactNode }) {
  return <main className={cn('mx-auto w-full flex-1 px-4 py-10', WIDTH[width])}>{children}</main>
}
