import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/signup', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid input', async () => {
    const res = await POST(makeRequest({ email: 'not-an-email', password: '123' }))
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as any)
    const res = await POST(makeRequest({ email: 'taken@example.com', password: 'longenough1' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/already/i)
  })

  it('creates a user with a hashed password on valid input', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'new-user',
      email: 'new@example.com',
      name: null,
    } as any)

    const res = await POST(makeRequest({ email: 'new@example.com', password: 'longenough1' }))
    expect(res.status).toBe(201)

    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0]
    expect(createArgs.data.email).toBe('new@example.com')
    expect(createArgs.data.passwordHash).not.toBe('longenough1')
  })
})
