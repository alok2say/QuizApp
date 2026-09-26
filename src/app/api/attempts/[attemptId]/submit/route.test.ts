import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/quiz/attempts', () => ({ submitAttempt: vi.fn() }))

import { getCurrentUser } from '@/lib/session'
import { submitAttempt } from '@/lib/quiz/attempts'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/attempts/attempt-1/submit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/attempts/[attemptId]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const res = await POST(makeRequest({ answers: [] }), { params: Promise.resolve({ attemptId: 'attempt-1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects a malformed body', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    const res = await POST(makeRequest({ answers: 'not-an-array' }), { params: Promise.resolve({ attemptId: 'attempt-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns the score on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    vi.mocked(submitAttempt).mockResolvedValue({ ok: true, score: 10, maxScore: 30 })

    const res = await POST(
      makeRequest({ answers: [{ questionId: 'q1', selectedOptionIds: ['a'] }] }),
      { params: Promise.resolve({ attemptId: 'attempt-1' }) },
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ score: 10, maxScore: 30 })
    expect(submitAttempt).toHaveBeenCalledWith('attempt-1', 'user-1', [
      { questionId: 'q1', selectedOptionIds: ['a'] },
    ])
  })

  it('passes through an error status from submitAttempt', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    vi.mocked(submitAttempt).mockResolvedValue({ ok: false, status: 409, error: 'Attempt already submitted.' })

    const res = await POST(makeRequest({ answers: [] }), { params: Promise.resolve({ attemptId: 'attempt-1' }) })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Attempt already submitted.' })
  })
})
