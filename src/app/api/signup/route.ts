import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/password'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

export async function POST(request: Request) {
  const json = await request.json()
  const parsed = signupSchema.safeParse(json)

  if (!parsed.success) {
    return Response.json({ error: 'Invalid email or password (min 8 characters).' }, { status: 400 })
  }

  const { email, password, name } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return Response.json({ error: 'An account with this email already exists.' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { email, passwordHash, name },
  })

  return Response.json({ id: user.id, email: user.email, name: user.name }, { status: 201 })
}
