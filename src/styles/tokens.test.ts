import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// Guards for the design system: every visual value lives in tokens.css.
const TOKENS = 'src/styles/tokens.css'
// @types/node 20 has no fs.globSync, so walk the tree
const cssFiles = (readdirSync('src', { recursive: true }) as string[])
  .filter((file) => file.endsWith('.css'))
  .map((file) => `src/${file}`)
  .sort()
const read = (file: string) => readFileSync(file, 'utf8')

// Files not yet moved off raw values. Each migration task removes its
// files; the last test fails if a listed file is already clean.
const PENDING_RAW_VALUES: string[] = [
  'src/app/admin/quizzes/admin.module.css',
  'src/app/controls.module.css',
  'src/app/library/[slug]/viewer.module.css',
  'src/app/library/library.module.css',
  'src/app/quizzes/[quizId]/leaderboard/leaderboard.module.css',
  'src/app/quizzes/[quizId]/result/[attemptId]/result.module.css',
  'src/app/quizzes/[quizId]/take/[attemptId]/take.module.css',
  'src/app/quizzes/answerSheet.module.css',
  'src/app/quizzes/page.module.css',
]

// next/font defines this one on <html>
const EXTERNAL_VARS = new Set(['--font-sans'])

const RAW_VALUE = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\d(\.\d+)?(rem|em|px|vh|vw)\b/i

function rawValueLines(file: string) {
  return read(file)
    .split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => RAW_VALUE.test(line) && !line.includes('token-exempt:'))
    .map(({ line, number }) => `${file}:${number}: ${line.trim()}`)
}

function colorTokens(block: string) {
  return [...block.matchAll(/(--color-[\w-]+)\s*:/g)].map((m) => m[1]).sort()
}

describe('design tokens', () => {
  test('every var() used in CSS is defined in tokens.css', () => {
    const defined = new Set([...read(TOKENS).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))
    const undefinedVars = cssFiles.flatMap((file) =>
      [...read(file).matchAll(/var\((--[\w-]+)/g)]
        .map((m) => m[1])
        .filter((name) => !defined.has(name) && !EXTERNAL_VARS.has(name))
        .map((name) => `${file}: ${name}`),
    )
    expect([...new Set(undefinedVars)]).toEqual([])
  })

  test('dark mode defines the same color tokens as light', () => {
    const css = read(TOKENS)
    const darkStart = css.indexOf('prefers-color-scheme: dark')
    expect(darkStart).toBeGreaterThan(-1)
    const light = colorTokens(css.slice(0, darkStart))
    const dark = colorTokens(css.slice(darkStart))
    expect(light.length).toBeGreaterThan(0)
    expect(dark).toEqual(light)
  })

  test('no raw values outside tokens.css', () => {
    const offenders = cssFiles
      .filter((file) => file !== TOKENS && !PENDING_RAW_VALUES.includes(file))
      .flatMap(rawValueLines)
    expect(offenders).toEqual([])
  })

  test('pending files still have raw values', () => {
    const alreadyClean = PENDING_RAW_VALUES.filter((file) => rawValueLines(file).length === 0)
    expect(alreadyClean).toEqual([])
  })
})
