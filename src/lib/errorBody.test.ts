import { describe, it, expect } from 'vitest'
import { readErrorBody } from './errorBody'

describe('readErrorBody', () => {
  it('returns the parsed JSON error body', async () => {
    const res = new Response(JSON.stringify({ error: 'Nope.', errors: ['a', 'b'] }), { status: 400 })
    expect(await readErrorBody(res)).toEqual({ error: 'Nope.', errors: ['a', 'b'] })
  })

  it('returns null when the body is empty or not JSON', async () => {
    expect(await readErrorBody(new Response(null, { status: 500 }))).toBeNull()
    expect(await readErrorBody(new Response('<html>oops</html>', { status: 500 }))).toBeNull()
  })

  it('returns null when the JSON is not an object', async () => {
    expect(await readErrorBody(new Response('"just a string"', { status: 500 }))).toBeNull()
  })
})
