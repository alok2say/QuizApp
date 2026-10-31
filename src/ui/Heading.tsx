import styles from './Heading.module.css'

// A title inside a page: list rows, sections
export function Heading({
  as: Tag = 'h2',
  id,
  children,
}: {
  as?: 'h2' | 'h3'
  id?: string
  children: React.ReactNode
}) {
  return (
    <Tag id={id} className={styles.heading}>
      {children}
    </Tag>
  )
}
