import {
  Actions,
  Button,
  ButtonLink,
  Description,
  EmptyState,
  ErrorMessage,
  Field,
  Form,
  Heading,
  Input,
  List,
  ListRow,
  Meta,
  NavButton,
  NavLink,
  Notice,
  Page,
  PageHeader,
  TextButton,
  TextLink,
  TopBar,
} from '@/ui'
import styles from './DesignCatalog.module.css'

const COLORS = [
  ['--color-text', 'Text'],
  ['--color-bg', 'Background'],
  ['--color-text-muted', 'Muted text'],
  ['--color-accent', 'Accent'],
  ['--color-on-accent', 'Text on accent'],
  ['--color-border', 'Borders and rules'],
  ['--color-success', 'Success'],
  ['--color-danger', 'Danger'],
] as const

// Every ui component and variant on one page, in the active tokens.
// Check a design change here first, then run scripts/visual-snapshots.py.
export function DesignCatalog() {
  return (
    <Page>
      <PageHeader
        title="Design system"
        intro="Every shared component in the current design. Change src/styles/tokens.css or src/ui and this page follows."
      />

      <Section title="Colors">
        <ul className={styles.swatches}>
          {COLORS.map(([token, label]) => (
            <li key={token} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(${token})` }} />
              <span>
                {label}
                <code className={styles.token}>{token}</code>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Page headers">
        <div className={styles.stack}>
          <PageHeader size="display" title="Display" intro="Home page title." />
          <PageHeader size="page" title="Page" intro="List pages: quizzes, library, leaderboard." />
          <PageHeader size="cover" title="Cover" intro="Log in and sign up." />
          <PageHeader size="sub" title="Sub" />
          <PageHeader title="With an action" action={<ButtonLink href="/design">Action</ButtonLink>} />
        </div>
      </Section>

      <Section title="Buttons and links">
        <Actions>
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button disabled>Disabled</Button>
          <ButtonLink href="/design" variant="secondary">Button link</ButtonLink>
        </Actions>
        <Actions>
          <TextLink href="/design">Text link</TextLink>
          <TextLink href="/design" tone="muted">Muted link</TextLink>
          <TextButton>Text button</TextButton>
          <TextButton tone="danger">Danger</TextButton>
        </Actions>
      </Section>

      <Section title="Forms and messages">
        <Form>
          <Field label="Email">
            <Input type="email" defaultValue="reader@example.com" />
          </Field>
          <Field label="Password" help="At least 8 characters">
            <Input type="password" defaultValue="password" />
          </Field>
          <ErrorMessage>That email and password don&apos;t match.</ErrorMessage>
          <Button type="button">Log in</Button>
        </Form>
        <ErrorMessage size="small">Small error, under a button.</ErrorMessage>
        <Notice tone="success">Success notice.</Notice>
        <Notice tone="accent">Accent notice.</Notice>
        <Notice as="div" tone="danger">
          <p>Danger notice with a list:</p>
          <ul>
            <li>First problem</li>
          </ul>
        </Notice>
      </Section>

      <Section title="Lists">
        <List>
          <ListRow>
            <div>
              <Heading as="h3">List row</Heading>
              <Description>A description under the title.</Description>
              <Meta>
                <span>Meta</span>
                <span>10 min</span>
                <a href="/design">Link</a>
              </Meta>
            </div>
            <ButtonLink href="/design" variant="secondary">Open</ButtonLink>
          </ListRow>
          <ListRow density="compact" align="baseline">
            <div>
              <Heading as="h3">Compact row</Heading>
              <Meta spacing="tight" tabular>3 questions, added 1 Nov 2026</Meta>
            </div>
            <TextLink href="/design">Edit</TextLink>
          </ListRow>
        </List>
        <EmptyState>Empty state: nothing here yet.</EmptyState>
      </Section>

      <Section title="Top bar">
        <div className={styles.frame}>
          <TopBar brand={{ label: 'Brand', href: '/design' }} navLabel="Sample">
            <NavLink href="/design">Current</NavLink>
            <NavLink href="/library">Other</NavLink>
            <NavButton>Button</NavButton>
          </TopBar>
        </div>
      </Section>
    </Page>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <Heading>{title}</Heading>
      {children}
    </section>
  )
}
