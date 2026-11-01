import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// Guards for the shadcn design system: styling is Tailwind classes plus the
// theme in src/app/globals.css; no CSS modules, no stray colors or one-off values.
const files = (readdirSync('src', { recursive: true }) as string[]).map((file) => `src/${file}`).sort()
const read = (file: string) => readFileSync(file, 'utf8')
const isTest = (file: string) => /\.test\.tsx?$/.test(file)

const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i
// an arbitrary value like p-[13px]; arbitrary variants like aria-[current=page]: are fine
const ARBITRARY_VALUE = /[\w-]-\[[^\]]+\](?!:)/

describe('design guards', () => {
  test('no CSS modules', () => {
    expect(files.filter((file) => file.endsWith('.module.css'))).toEqual([])
  })

  test('the only stylesheet is the theme in globals.css', () => {
    expect(files.filter((file) => file.endsWith('.css'))).toEqual(['src/app/globals.css'])
  })

  test('no color literals outside the theme', () => {
    const offenders = files
      .filter((file) => /\.(css|tsx?)$/.test(file) && !isTest(file))
      .filter((file) => file !== 'src/app/globals.css')
      .filter((file) => COLOR_LITERAL.test(read(file)))
    expect(offenders).toEqual([])
  })

  test('no arbitrary Tailwind values in features and ui', () => {
    const offenders = files
      .filter((file) => /^src\/(features|ui)\/.*\.tsx$/.test(file) && !isTest(file))
      .flatMap((file) =>
        read(file)
          .split('\n')
          .map((line, index) => ({ line, number: index + 1 }))
          .filter(({ line }) => ARBITRARY_VALUE.test(line))
          .map(({ line, number }) => `${file}:${number}: ${line.trim()}`),
      )
    expect(offenders).toEqual([])
  })
})
