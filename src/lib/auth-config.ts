// Auth0 settings from Vite env (.env.local locally, Vercel env vars in production).

export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN as string | undefined,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined,
}

export const isAuthConfigured = Boolean(auth0Config.domain && auth0Config.clientId && auth0Config.audience)

/** Namespace for custom claims set by the Auth0 Post-Login Action. Must match server/auth.ts. */
export const CLAIM_NS = 'https://sejuk-ops'
