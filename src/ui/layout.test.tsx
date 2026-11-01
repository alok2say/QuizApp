import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { EmptyState, Page, PageHeader } from './index'

const html = (node: React.ReactElement) => renderToStaticMarkup(node)

describe('layout primitives', () => {
  test('Page renders a centered main with the width class', () => {
    expect(html(<Page>x</Page>)).toMatch(/^<main class="[^"]*\bmx-auto\b[^"]*\bmax-w-3xl\b[^"]*">x<\/main>$/)
    expect(html(<Page width="narrow">x</Page>)).toContain('max-w-sm')
    expect(html(<Page width="wide">x</Page>)).toContain('max-w-5xl')
  })

  test('PageHeader renders h1 then description', () => {
    const out = html(<PageHeader title="Quizzes" description="Pick one." />)
    expect(out.indexOf('<h1')).toBeGreaterThan(-1)
    expect(out.indexOf('<h1')).toBeLessThan(out.indexOf('Pick one.'))
    expect(out).toContain('text-muted-foreground')
  })

  test('PageHeader without description renders no paragraph', () => {
    expect(html(<PageHeader title="Quizzes" />)).not.toContain('<p')
  })

  test('PageHeader renders the action', () => {
    expect(html(<PageHeader title="Manage quizzes" action={<a href="/new">New quiz</a>} />)).toContain(
      '<a href="/new">New quiz</a>',
    )
  })

  test('EmptyState is a muted paragraph', () => {
    expect(html(<EmptyState>None yet.</EmptyState>)).toMatch(/^<p class="[^"]*text-muted-foreground[^"]*">None yet\.<\/p>$/)
  })
})
