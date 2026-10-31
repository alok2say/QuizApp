import styles from './Notice.module.css'

// A message set off by a colored bar on the left
export function Notice({
  tone,
  as: Tag = 'p',
  role,
  children,
}: {
  tone: 'success' | 'accent' | 'danger'
  as?: 'p' | 'div'
  role?: 'alert' | 'status'
  children: React.ReactNode
}) {
  return (
    <Tag role={role} className={`${styles.notice} ${styles[tone]}`}>
      {children}
    </Tag>
  )
}
