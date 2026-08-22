import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/quiz/attempts', () => ({ startAttempt: vi.fn() }))

import { getCurrentUser } from '@/lib/session'
import { startAttempt } from '@/lib/quiz/attempts'
import { POST } from './route'

function makeRequest() {
  return new Request('http://localhost/api/quizzes/quiz-1/start', { method: 'POST' })
}

describe('POST /api/quizzes/[quizId]/start', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const res = await POST(makeRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns the attemptId on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    vi.mocked(startAttempt).mockResolvedValue({ ok: true, attemptId: 'attempt-1' })

    const res = await POST(makeRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ attemptId: 'attempt-1' })
    expect(startAttempt).toHaveBeenCalledWith('quiz-1', 'user-1')
  })

  it('passes through the status/body when startAttempt reports a conflict', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    vi.mocked(startAttempt).mockResolvedValue({
      ok: false,
      status: 409,
      error: 'You have already attempted this quiz.',
      attemptId: 'attempt-1',
      resume: false,
    })

    const res = await POST(makeRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'You have already attempted this quiz.',
      attemptId: 'attempt-1',
      resume: false,
    })
  })
})
