import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { Heading, Page, PageHeader, VisuallyHidden } from './index'
import pageStyles from './Page.module.css'
import headerStyles from './PageHeader.module.css'

const html = (node: React.ReactElement) => renderToStaticMarkup(node)

describe('layout primitives', () => {
  test('Page wraps children in main with the width class', () => {
    const out = html(<Page width="wide">x</Page>)
    expect(out).toMatch(
      new RegExp(`^<div class="[^"]*${pageStyles.page}[^"]*"><main class="[^"]*${pageStyles.wide}[^"]*">x</main></div>$`),
    )
  })

  test('Page top variant goes on the outer div', () => {
    const out = html(<Page top="hero">x</Page>)
    expect(out.startsWith(`<div class="${pageStyles.page} ${pageStyles.hero}"`)).toBe(true)
  })

  test('PageHeader renders h1 then intro', () => {
    const out = html(<PageHeader title="Quizzes" intro="Pick one." />)
    expect(out.indexOf('<h1')).toBeGreaterThan(-1)
    expect(out.indexOf('<h1')).toBeLessThan(out.indexOf('Pick one.'))
    expect(out).toContain(headerStyles.page)
  })

  test('PageHeader without intro renders no paragraph', () => {
    expect(html(<PageHeader title="Quizzes" />)).not.toContain('<p')
  })

  test('PageHeader renders action next to the title', () => {
    const out = html(<PageHeader title="Manage quizzes" action={<a href="/new">New quiz</a>} />)
    expect(out).toMatch(new RegExp(`class="${headerStyles.row}"><h1[^>]*>Manage quizzes</h1><a href="/new">New quiz</a></div>`))
  })

  test('Heading defaults to h2 and accepts h3', () => {
    expect(html(<Heading>T</Heading>).startsWith('<h2')).toBe(true)
    expect(html(<Heading as="h3" id="x">T</Heading>)).toMatch(/^<h3 id="x"/)
  })

  test('VisuallyHidden can render a thead', () => {
    expect(html(<table><VisuallyHidden as="thead"><tr><th>R</th></tr></VisuallyHidden></table>)).toContain('<thead class=')
  })
})
