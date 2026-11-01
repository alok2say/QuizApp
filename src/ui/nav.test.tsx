import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { NavLink } from './index'

describe('navigation', () => {
  test('NavLink renders href and no aria-current outside a router', () => {
    const out = renderToStaticMarkup(<NavLink href="/quizzes">Quizzes</NavLink>)
    expect(out).toMatch(/href="\/quizzes"/)
    expect(out).not.toContain('aria-current')
    expect(out).toContain('aria-[current=page]:bg-muted')
  })

  test('importing @/ui from node works', async () => {
    const ui = await import('@/ui')
    expect(typeof ui.NavLink).toBe('function')
    expect(typeof ui.Page).toBe('function')
  })
})
