// Only same-site relative paths are allowed; "//host" and "/\host" are
// treated by browsers as another host, so they're rejected too.
export function safeCallbackUrl(value: string | null): string {
  if (!value || !value.startsWith('/')) return '/'
  if (value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
