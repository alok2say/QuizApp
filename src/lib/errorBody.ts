export type ErrorBody = { error?: string; errors?: string[] }

// A raw 500 (e.g. an unhandled Prisma error) has no JSON body, so callers
// must handle null instead of assuming res.json() succeeds.
export async function readErrorBody(res: Response): Promise<ErrorBody | null> {
  try {
    const body = await res.json()
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}
