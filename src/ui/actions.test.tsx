import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { Button, ButtonLink, TextButton, TextLink } from './index'
import buttonStyles from './Button.module.css'
import linkStyles from './TextLink.module.css'

const html = (node: React.ReactElement) => renderToStaticMarkup(node)

describe('actions', () => {
  test('Button defaults to type=button primary', () => {
    const out = html(<Button>Go</Button>)
    expect(out).toContain('type="button"')
    expect(out).toContain(buttonStyles.primary)
  })

  test('Button submit + disabled + secondary', () => {
    const out = html(<Button type="submit" variant="secondary" disabled>Go</Button>)
    expect(out).toContain('type="submit"')
    expect(out).toContain('disabled=""')
    expect(out).toContain(buttonStyles.secondary)
  })

  test('ButtonLink renders an anchor with href and variant class', () => {
    const out = html(<ButtonLink href="/quizzes" variant="secondary">Read</ButtonLink>)
    expect(out).toMatch(/^<a [^>]*href="\/quizzes"/)
    expect(out).toContain(buttonStyles.secondary)
  })

  test('TextButton danger has the danger class and type=button', () => {
    const out = html(<TextButton tone="danger">Delete</TextButton>)
    expect(out).toMatch(/^<button type="button"/)
    expect(out).toContain(linkStyles.danger)
  })

  test('TextLink muted tone', () => {
    const out = html(<TextLink href="/library" tone="muted">Library</TextLink>)
    expect(out).toMatch(/^<a [^>]*href="\/library"/)
    expect(out).toContain(linkStyles.muted)
  })
})
