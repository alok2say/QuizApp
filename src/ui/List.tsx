import styles from './List.module.css'

// A ruled list: a rule above the first row and below every row
export function List({ as: Tag = 'ul', children }: { as?: 'ul' | 'ol'; children: React.ReactNode }) {
  return <Tag className={styles.list}>{children}</Tag>
}

export function ListRow({
  align = 'start',
  density = 'default',
  className,
  children,
}: {
  align?: 'start' | 'baseline'
  density?: 'default' | 'compact'
  // a feature can swap in its own row layout (e.g. a grid)
  className?: string
  children: React.ReactNode
}) {
  const classes = [styles.row, styles[align], density === 'compact' ? styles.compact : '', className ?? '']
  return <li className={classes.filter(Boolean).join(' ')}>{children}</li>
}
