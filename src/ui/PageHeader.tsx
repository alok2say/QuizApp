import styles from './PageHeader.module.css'

type Size = 'display' | 'page' | 'cover' | 'sub'

// The page's h1, an optional intro line, and an optional action beside the title
export function PageHeader({
  title,
  intro,
  size = 'page',
  action,
}: {
  title: React.ReactNode
  intro?: React.ReactNode
  size?: Size
  action?: React.ReactNode
}) {
  const heading = <h1 className={styles.title}>{title}</h1>

  return (
    <div className={styles[size]}>
      {action ? (
        <div className={styles.row}>
          {heading}
          {action}
        </div>
      ) : (
        heading
      )}
      {intro && <p className={styles.intro}>{intro}</p>}
    </div>
  )
}
