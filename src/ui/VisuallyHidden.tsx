import styles from './VisuallyHidden.module.css'

// Read by screen readers, not shown on screen
export function VisuallyHidden({
  as: Tag = 'span',
  children,
}: {
  as?: 'span' | 'thead'
  children: React.ReactNode
}) {
  return <Tag className={styles.hidden}>{children}</Tag>
}
