import { describe, it, expect } from 'vitest'
import { isActivePath } from './activePath'

describe('isActivePath', () => {
  it('matches the exact path and anything below it', () => {
    expect(isActivePath('/quizzes', '/quizzes')).toBe(true)
    expect(isActivePath('/quizzes/abc/take/def', '/quizzes')).toBe(true)
    expect(isActivePath('/admin/quizzes/new', '/admin/quizzes')).toBe(true)
  })

  it('does not match siblings that merely share a prefix', () => {
    expect(isActivePath('/quizzes-archive', '/quizzes')).toBe(false)
    expect(isActivePath('/', '/quizzes')).toBe(false)
  })
})
