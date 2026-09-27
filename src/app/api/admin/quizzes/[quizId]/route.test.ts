import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/quiz/adminQuizzes', () => ({
  replaceQuizFromJson: vi.fn(),
  deleteQuizById: vi.fn(),
}))

import { getCurrentUser } from '@/lib/session'
import { replaceQuizFromJson, deleteQuizById } from '@/lib/quiz/adminQuizzes'
import { PUT, DELETE } from './route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/quizzes/quiz-1', {
    method: 'PUT',
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

describe('PUT /api/admin/quizzes/[quizId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const res = await PUT(makeRequest(validBody), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when logged in but not an admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    const res = await PUT(makeRequest(validBody), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 400 for a malformed JSON body', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    const res = await PUT(makeRequest('{not valid json'), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 when replaceQuizFromJson reports the quiz missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(replaceQuizFromJson).mockResolvedValue({ ok: false, status: 404, error: 'Quiz not found.' })

    const res = await PUT(makeRequest(validBody), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Quiz not found.' })
  })

  it('replaces the quiz and returns 200 on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(replaceQuizFromJson).mockResolvedValue({ ok: true })

    const res = await PUT(makeRequest(validBody), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(200)
    expect(replaceQuizFromJson).toHaveBeenCalledWith('quiz-1', expect.objectContaining({ title: 'Capitals Quiz' }))
  })
})

function makeDeleteRequest() {
  return new Request('http://localhost/api/admin/quizzes/quiz-1', { method: 'DELETE' })
}

describe('DELETE /api/admin/quizzes/[quizId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not logged in', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns 403 when logged in but not an admin', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1', role: 'USER' })
    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 when deleteQuizById reports the quiz missing', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(deleteQuizById).mockResolvedValue({ ok: false, status: 404, error: 'Quiz not found.' })

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(404)
  })

  it('deletes the quiz and returns 204 on success', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
    vi.mocked(deleteQuizById).mockResolvedValue({ ok: true })

    const res = await DELETE(makeDeleteRequest(), { params: Promise.resolve({ quizId: 'quiz-1' }) })

    expect(res.status).toBe(204)
  })
})
