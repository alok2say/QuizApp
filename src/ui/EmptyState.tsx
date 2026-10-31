import styles from './EmptyState.module.css'

// What a list shows when it has nothing in it
export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>
}
