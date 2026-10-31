import Link from 'next/link'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary'

export function Button({
  variant = 'primary',
  type = 'button',
  disabled,
  onClick,
  children,
}: {
  variant?: Variant
  type?: 'button' | 'submit'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button type={type} className={`${styles.button} ${styles[variant]}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

// Looks like a button, navigates like a link
export function ButtonLink({
  variant = 'primary',
  href,
  children,
}: {
  variant?: Variant
  href: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={`${styles.button} ${styles[variant]}`}>
      {children}
    </Link>
  )
}
