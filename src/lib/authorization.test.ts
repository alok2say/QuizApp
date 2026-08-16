import { describe, it, expect } from 'vitest'
import { isAuthorizedForPath } from './authorization'

describe('isAuthorizedForPath', () => {
  it('allows anyone to access public paths', () => {
    expect(isAuthorizedForPath('/', null)).toBe(true)
    expect(isAuthorizedForPath('/login', null)).toBe(true)
    expect(isAuthorizedForPath('/signup', null)).toBe(true)
  })

  it('denies unauthenticated users on protected paths', () => {
    expect(isAuthorizedForPath('/quizzes', null)).toBe(false)
    expect(isAuthorizedForPath('/admin/quizzes', null)).toBe(false)
  })

  it('allows any logged-in user on general protected paths', () => {
    expect(isAuthorizedForPath('/quizzes', 'USER')).toBe(true)
    expect(isAuthorizedForPath('/quizzes/123', 'USER')).toBe(true)
  })

  it('denies non-admin users on admin paths', () => {
    expect(isAuthorizedForPath('/admin/quizzes', 'USER')).toBe(false)
  })

  it('allows admin users on admin paths', () => {
    expect(isAuthorizedForPath('/admin/quizzes', 'ADMIN')).toBe(true)
  })
})
