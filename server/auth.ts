import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

/** Namespace for custom claims added by the Auth0 Post-Login Action (auth0/post-login-action.js). */
export const CLAIM_NS = 'https://sejuk-ops'

export const ROLES = ['admin', 'technician', 'manager'] as const
export type Role = (typeof ROLES)[number]

export type AuthUser = {
  sub: string
  roles: Role[]
  /** Technician name from the assessment (Ali, John, …) for technician accounts, else null. */
  technician: string | null
  name: string | null
  email: string | null
}

export type AuthEnv = { Variables: { user: AuthUser } }

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function authConfig() {
  const domain = process.env.AUTH0_DOMAIN
  const audience = process.env.AUTH0_AUDIENCE
  if (!domain || !audience) {
    throw new HTTPException(500, { message: 'Auth is not configured on the server (AUTH0_DOMAIN / AUTH0_AUDIENCE).' })
  }
  jwks ??= createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`))
  return { issuer: `https://${domain}/`, audience, jwks }
}

function toAuthUser(payload: JWTPayload): AuthUser {
  const rawRoles = payload[`${CLAIM_NS}/roles`]
  const roles = (Array.isArray(rawRoles) ? rawRoles : [])
    .map((r) => String(r).toLowerCase())
    .filter((r): r is Role => (ROLES as readonly string[]).includes(r))
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)

  return {
    sub: payload.sub!,
    roles,
    technician: str(payload[`${CLAIM_NS}/technician`]),
    name: str(payload[`${CLAIM_NS}/name`]),
    email: str(payload[`${CLAIM_NS}/email`]),
  }
}

/** Verifies the Auth0 access token (signature, issuer, audience, expiry) and sets c.var.user. */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw new HTTPException(401, { message: 'Missing access token' })

  const { issuer, audience, jwks } = authConfig()
  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(token, jwks, { issuer, audience, algorithms: ['RS256'] }))
  } catch {
    throw new HTTPException(401, { message: 'Invalid or expired access token' })
  }
  if (!payload.sub) throw new HTTPException(401, { message: 'Token has no subject' })

  c.set('user', toAuthUser(payload))
  await next()
})

/** Allows the request only if the user has at least one of the given roles. Use after requireAuth. */
export const requireRole = (...allowed: Role[]) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const { roles } = c.get('user')
    if (!roles.some((r) => allowed.includes(r))) {
      throw new HTTPException(403, { message: `Requires role: ${allowed.join(' or ')}` })
    }
    await next()
  })
