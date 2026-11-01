import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { NavButton, NavLink, TopBar } from './index'

const html = (node: React.ReactElement) => renderToStaticMarkup(node)

describe('navigation', () => {
  test('TopBar renders brand link and labelled nav', () => {
    const out = html(<TopBar brand={{ label: 'DemoQuizApp', href: '/' }} navLabel="Site">links</TopBar>)
    expect(out).toMatch(/^<header class="[^"]+"><div class="[^"]+"><a class="[^"]+" href="\/">DemoQuizApp<\/a><nav class="[^"]+" aria-label="Site">links<\/nav><\/div><\/header>$/)
  })

  test('NavLink renders href and no aria-current outside a router', () => {
    const out = html(<NavLink href="/quizzes">Quizzes</NavLink>)
    expect(out).toMatch(/href="\/quizzes"/)
    expect(out).not.toContain('aria-current')
    expect(out).toContain('aria-[current=page]:bg-muted')
  })

  test('NavButton is a type=button styled like a nav link', () => {
    const out = html(<NavButton>Log out</NavButton>)
    expect(out).toMatch(/^<button type="button" class="[^"]+">Log out<\/button>$/)
  })

  test('importing @/ui from node works', async () => {
    const ui = await import('@/ui')
    expect(typeof ui.NavLink).toBe('function')
    expect(typeof ui.Page).toBe('function')
  })
})
