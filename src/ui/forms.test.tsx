import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { ErrorMessage, Field, Form, Input, Notice } from './index'
import formStyles from './Form.module.css'
import noticeStyles from './Notice.module.css'

const html = (node: React.ReactElement) => renderToStaticMarkup(node)

describe('forms and messages', () => {
  test('Form renders a form with the stack class', () => {
    expect(html(<Form>x</Form>)).toBe(`<form class="${formStyles.form}">x</form>`)
  })

  test('Field wraps input inside label with help after', () => {
    const out = html(<Field label="Password" help="At least 8 characters"><Input type="password" /></Field>)
    expect(out).toMatch(/^<label class="[^"]+">Password<input [^>]*type="password"[^>]*\/><span class="[^"]+">At least 8 characters<\/span><\/label>$/)
  })

  test('Input forwards type, required, minLength and autoComplete', () => {
    const out = html(<Input type="email" required minLength={8} autoComplete="email" />)
    expect(out).toContain('type="email"')
    expect(out).toContain('required=""')
    expect(out).toContain('minLength="8"')
    expect(out).toContain('autoComplete="email"')
    expect(out).toContain(formStyles.input)
  })

  test('ErrorMessage has role=alert', () => {
    expect(html(<ErrorMessage>Nope</ErrorMessage>)).toMatch(/^<p role="alert" class="[^"]+">Nope<\/p>$/)
  })

  test('ErrorMessage small has the small class', () => {
    expect(html(<ErrorMessage size="small">Nope</ErrorMessage>)).toContain(formStyles.small)
  })

  test('Notice tone class and passes role', () => {
    const out = html(<Notice as="div" tone="danger" role="alert"><p>Fix</p></Notice>)
    expect(out).toMatch(/^<div role="alert" class="[^"]+">/)
    expect(out).toContain(noticeStyles.danger)
    expect(html(<Notice tone="success">Done</Notice>)).toMatch(new RegExp(`^<p class="[^"]*${noticeStyles.success}`))
  })
})
