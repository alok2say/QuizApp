import Link from 'next/link'
import styles from './TextLink.module.css'

export function TextLink({
  href,
  tone = 'default',
  children,
}: {
  href: string
  tone?: 'default' | 'muted'
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={`${styles.link} ${styles[tone]}`}>
      {children}
    </Link>
  )
}

// A button that reads like a text link (e.g. Delete in a list row)
export function TextButton({
  tone = 'default',
  onClick,
  disabled,
  children,
}: {
  tone?: 'default' | 'danger'
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button type="button" className={`${styles.link} ${styles.button} ${styles[tone]}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
