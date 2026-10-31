import styles from './Page.module.css'

type Width = 'narrow' | 'medium' | 'default' | 'wide'
type Top = 'default' | 'cover' | 'hero'

// The page shell: outer padding, then a centered column of the given width
export function Page({
  width = 'default',
  top = 'default',
  children,
}: {
  width?: Width
  top?: Top
  children: React.ReactNode
}) {
  return (
    <div className={top === 'default' ? styles.page : `${styles.page} ${styles[top]}`}>
      <main className={width === 'default' ? styles.main : `${styles.main} ${styles[width]}`}>{children}</main>
    </div>
  )
}
