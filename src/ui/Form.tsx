import styles from './Form.module.css'

export function Form({
  onSubmit,
  children,
}: {
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void
  children: React.ReactNode
}) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {children}
    </form>
  )
}

// Label text above the control, optional help below; the label wraps both
export function Field({
  label,
  help,
  children,
}: {
  label: React.ReactNode
  help?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className={styles.field}>
      {label}
      {children}
      {help && <span className={styles.help}>{help}</span>}
    </label>
  )
}

// A write-in line: bottom rule only, accent on focus
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={styles.input} />
}

export function ErrorMessage({ size = 'body', children }: { size?: 'body' | 'small'; children: React.ReactNode }) {
  return (
    <p role="alert" className={`${styles.error} ${styles[size]}`}>
      {children}
    </p>
  )
}
