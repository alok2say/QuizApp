import { describe, it, expect, vi } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

import { getServerSession } from 'next-auth'
import { getCurrentUser } from './session'

describe('getCurrentUser', () => {
  it('returns null when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect(await getCurrentUser()).toBeNull()
  })

  it('returns the session user when logged in', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-1', role: 'USER' },
    } as never)
    expect(await getCurrentUser()).toEqual({ id: 'user-1', role: 'USER' })
  })
})
