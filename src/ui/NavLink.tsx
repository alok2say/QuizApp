'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { isActivePath } from '@/lib/activePath'
import { cn } from '@/lib/utils'

// A header link that marks itself as the current section
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <Link
      href={href}
      aria-current={isActivePath(pathname, href) ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        'text-muted-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground',
      )}
    >
      {children}
    </Link>
  )
}
