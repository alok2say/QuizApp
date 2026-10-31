import Link from 'next/link'
import styles from './TopBar.module.css'

// Site-wide bar: brand link on the left, navigation on the right
export function TopBar({
  brand,
  navLabel,
  children,
}: {
  brand: { label: string; href: string }
  navLabel: string
  children: React.ReactNode
}) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} href={brand.href}>
          {brand.label}
        </Link>
        <nav className={styles.nav} aria-label={navLabel}>
          {children}
        </nav>
      </div>
    </header>
  )
}

// For actions in the bar, like Log out
export function NavButton({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={styles.link} onClick={onClick}>
      {children}
    </button>
  )
}
