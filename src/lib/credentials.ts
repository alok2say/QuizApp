import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'

export async function verifyCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string; role: 'USER' | 'ADMIN' } | null> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return null

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null

  return { id: user.id, email: user.email, role: user.role as 'USER' | 'ADMIN' }
}
