'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isActivePath } from '@/lib/activePath'
import styles from './TopBar.module.css'

// A TopBar link that marks itself as the current section
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <Link href={href} className={styles.link} aria-current={isActivePath(pathname, href) ? 'page' : undefined}>
      {children}
    </Link>
  )
}
