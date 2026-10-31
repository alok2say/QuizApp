import { describe, it, expect } from 'vitest'
import { safeCallbackUrl, withCallbackUrl } from './safeRedirect'

describe('withCallbackUrl', () => {
  it('leaves the link bare when the destination is Home', () => {
    expect(withCallbackUrl('/signup', '/')).toBe('/signup')
  })

  it('appends an encoded callbackUrl otherwise', () => {
    expect(withCallbackUrl('/login', '/quizzes/a?x=1')).toBe('/login?callbackUrl=%2Fquizzes%2Fa%3Fx%3D1')
  })
})

describe('safeCallbackUrl', () => {
  it('keeps same-site relative paths, including the query string', () => {
    expect(safeCallbackUrl('/quizzes')).toBe('/quizzes')
    expect(safeCallbackUrl('/quizzes/abc/leaderboard?x=1')).toBe('/quizzes/abc/leaderboard?x=1')
  })

  it('falls back to / when missing or empty', () => {
    expect(safeCallbackUrl(null)).toBe('/')
    expect(safeCallbackUrl('')).toBe('/')
  })

  it('rejects absolute and protocol-relative URLs to other hosts', () => {
    expect(safeCallbackUrl('https://evil.example')).toBe('/')
    expect(safeCallbackUrl('//evil.example')).toBe('/')
    expect(safeCallbackUrl('/\\evil.example')).toBe('/')
    expect(safeCallbackUrl('javascript:alert(1)')).toBe('/')
  })
})
