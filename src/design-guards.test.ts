import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

// Guards for the shadcn design system: styling is Tailwind classes plus the
// theme in src/app/globals.css; no CSS modules, no stray colors or one-off values.
const files = (readdirSync('src', { recursive: true }) as string[]).map((file) => `src/${file}`).sort()
const read = (file: string) => readFileSync(file, 'utf8')
const isTest = (file: string) => /\.test\.tsx?$/.test(file)

// CSS modules not yet migrated. Each migration task deletes its files and
// removes them here; the second test fails if a listed file is already gone.
const PENDING_MODULES: string[] = [
  'src/features/admin/AdminQuizListView.module.css',
  'src/features/admin/QuizJsonEditor.module.css',
  'src/features/attempt/TakeView.module.css',
  'src/features/attempt/answerSheet.module.css',
  'src/features/design/DesignCatalog.module.css',
  'src/ui/Actions.module.css',
  'src/ui/Button.module.css',
  'src/ui/Form.module.css',
  'src/ui/Heading.module.css',
  'src/ui/List.module.css',
  'src/ui/Notice.module.css',
  'src/ui/Text.module.css',
  'src/ui/TextLink.module.css',
  'src/ui/VisuallyHidden.module.css',
]

const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/i
// an arbitrary value like p-[13px]; arbitrary variants like aria-[current=page]: are fine
const ARBITRARY_VALUE = /[\w-]-\[[^\]]+\](?!:)/

describe('design guards', () => {
  test('no CSS modules outside the pending list', () => {
    const modules = files.filter((file) => file.endsWith('.module.css'))
    expect(modules.filter((file) => !PENDING_MODULES.includes(file))).toEqual([])
  })

  test('pending modules still exist', () => {
    expect(PENDING_MODULES.filter((file) => !files.includes(file))).toEqual([])
  })

  test('no color literals outside the theme', () => {
    const offenders = files
      .filter((file) => /\.(css|tsx?)$/.test(file) && !isTest(file))
      .filter((file) => file !== 'src/app/globals.css' && !PENDING_MODULES.includes(file))
      .filter((file) => file !== 'src/styles/tokens.css')
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
