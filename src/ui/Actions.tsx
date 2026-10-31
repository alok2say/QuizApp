import styles from './Actions.module.css'

const GAP = { tight: styles.gapTight, default: styles.gapDefault, loose: styles.gapLoose }
const SPACING = { default: '', loose: styles.spacingLoose }

// A wrapping row of buttons and links
export function Actions({
  gap = 'default',
  spacing = 'default',
  children,
}: {
  gap?: 'tight' | 'default' | 'loose'
  spacing?: 'default' | 'loose'
  children: React.ReactNode
}) {
  return <div className={[styles.actions, GAP[gap], SPACING[spacing]].filter(Boolean).join(' ')}>{children}</div>
}
