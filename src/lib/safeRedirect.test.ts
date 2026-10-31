import { describe, it, expect } from 'vitest'
import { safeCallbackUrl } from './safeRedirect'

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
