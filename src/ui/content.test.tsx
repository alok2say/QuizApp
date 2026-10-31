import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { Actions, Description, EmptyState, List, ListRow, Meta } from './index'
import listStyles from './List.module.css'
import textStyles from './Text.module.css'
import actionStyles from './Actions.module.css'

const html = (node: React.ReactElement) => renderToStaticMarkup(node)

describe('content', () => {
  test('List renders ul by default and ol when asked', () => {
    expect(html(<List>x</List>)).toBe(`<ul class="${listStyles.list}">x</ul>`)
    expect(html(<List as="ol">x</List>).startsWith('<ol')).toBe(true)
  })

  test('ListRow compact + baseline classes and passes className', () => {
    const out = html(<ListRow density="compact" align="baseline" className="extra">x</ListRow>)
    expect(out).toMatch(/^<li class="[^"]+">x<\/li>$/)
    for (const name of [listStyles.row, listStyles.compact, listStyles.baseline, 'extra']) expect(out).toContain(name)
  })

  test('Description is a muted paragraph', () => {
    expect(html(<Description>d</Description>)).toBe(`<p class="${textStyles.description}">d</p>`)
  })

  test('Meta tight and tabular', () => {
    const out = html(<Meta spacing="tight" tabular>m</Meta>)
    for (const name of [textStyles.meta, textStyles.tight, textStyles.tabular]) expect(out).toContain(name)
    expect(html(<Meta>m</Meta>)).not.toContain(textStyles.tight)
  })

  test('EmptyState renders a p', () => {
    expect(html(<EmptyState>None yet.</EmptyState>)).toMatch(/^<p class="[^"]+">None yet\.<\/p>$/)
  })

  test('Actions gap and spacing classes', () => {
    const out = html(<Actions gap="loose" spacing="loose">a</Actions>)
    expect(out).toContain(actionStyles.gapLoose)
    expect(out).toContain(actionStyles.spacingLoose)
  })
})
