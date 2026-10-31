// A nav link stays active on its own page and every page nested under it.
// pathname is null outside the App Router (e.g. a component rendered in a test).
export function isActivePath(pathname: string | null, href: string): boolean {
  if (pathname === null) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}
