import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyCredentials } from './credentials'

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/password', () => ({
  verifyPassword: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'

describe('verifyCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no user matches the email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    const result = await verifyCredentials('nobody@example.com', 'password123')
    expect(result).toBeNull()
  })

  it('returns null when the password does not match', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hashed',
      role: 'USER',
    } as never)
    vi.mocked(verifyPassword).mockResolvedValue(false)
    const result = await verifyCredentials('user@example.com', 'wrong')
    expect(result).toBeNull()
  })

  it('returns the user id/email/role when the password matches', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hashed',
      role: 'ADMIN',
    } as never)
    vi.mocked(verifyPassword).mockResolvedValue(true)
    const result = await verifyCredentials('user@example.com', 'correct')
    expect(result).toEqual({ id: 'u1', email: 'user@example.com', role: 'ADMIN' })
  })
})
