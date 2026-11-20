// Fetch wrapper for /api that attaches the Auth0 access token.

export class ApiError extends Error {
  readonly status: number
  /** Per-field validation messages from the API (400), keyed by field name. */
  readonly fields: Record<string, string>
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

type TokenGetter = () => Promise<string>
let getToken: TokenGetter | null = null

/** Called once by SessionProvider so query functions can fetch without hooks. */
export function setTokenGetter(fn: TokenGetter | null) {
  getToken = fn
}

export async function apiFetch<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth = true, ...rest } = init
  const headers = new Headers(rest.headers)
  if (rest.body && !(rest.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (auth && getToken) headers.set('Authorization', `Bearer ${await getToken()}`)

  const res = await fetch(`/api${path}`, { ...rest, headers })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText, body.fields)
  return body as T
}
