import styles from './Text.module.css'

// Supporting line under a title
export function Description({ children }: { children: React.ReactNode }) {
  return <p className={styles.description}>{children}</p>
}

// Small facts about an item: counts, times, a link
export function Meta({
  spacing = 'default',
  tabular = false,
  children,
}: {
  spacing?: 'default' | 'tight'
  // tabular figures, for lists of numbers that should line up
  tabular?: boolean
  children: React.ReactNode
}) {
  const classes = [styles.meta, spacing === 'tight' ? styles.tight : '', tabular ? styles.tabular : '']
  return <p className={classes.filter(Boolean).join(' ')}>{children}</p>
}
