const PUBLIC_PATHS = ['/', '/login', '/signup']

export function isAuthorizedForPath(pathname: string, role: 'USER' | 'ADMIN' | null): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true

  if (pathname.startsWith('/admin')) {
    return role === 'ADMIN'
  }

  // Any other path (e.g. /quizzes, /quizzes/[id], /quizzes/[id]/leaderboard)
  // requires any logged-in user.
  return role === 'USER' || role === 'ADMIN'
}
