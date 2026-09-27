import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/quiz/adminQuizzes', () => ({ createQuizFromJson: vi.fn() }))

import { getCurrentUser } from '@/lib/session'
import { createQuizFromJson } from '@/lib/quiz/adminQuizzes'
import { POST } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/quizzes', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = {
  title: 'Capitals Quiz',
  timeLimitSeconds: 300,
  retakePolicy: 'UNLIMITED_BEST',
  feedbackMode: 'END_ONLY',
  questions: [
    {
      text: 'What is the capital of France?',
      type: 'SINGLE_SELECT',
      options: [
        { text: 'Paris', isCorrect: true },
        { text: 'London', isCorrect: false },
      ],
    },
  ],
}

describe('POST /api/admin/quizzes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when logged in but not an admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 for a malformed JSON body', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    const res = await POST(makeRequest('{not valid json'))
    expect(res.status).toBe(400)
  })

  it('returns 400 with validation errors for a semantically invalid quiz', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    const res = await POST(makeRequest({ ...validBody, questions: [] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ errors: ['Quiz must have at least 1 question.'] })
  })

  it('creates the quiz and returns its id on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(createQuizFromJson).mockResolvedValue({ id: 'quiz-1' })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'quiz-1' })
  })
})
