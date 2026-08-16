import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAuthorizedForPath } from '@/lib/authorization'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const role = (token?.role as 'USER' | 'ADMIN' | undefined) ?? null

  if (isAuthorizedForPath(request.nextUrl.pathname, role)) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/quizzes/:path*', '/admin/:path*'],
}
