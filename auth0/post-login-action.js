/**
 * Auth0 Post-Login Action: "Add Sejuk Ops claims"
 * Paste into Auth0 Dashboard → Actions → Library → Create Action → Login / Post Login,
 * then Deploy and drag it into Actions → Triggers → post-login.
 *
 * Adds namespaced claims to the ID token (read by the React app for routing)
 * and the access token (verified by the API for authorization):
 *   https://sejuk-ops/roles       ["admin" | "technician" | "manager"]  from Auth0 RBAC roles
 *   https://sejuk-ops/technician  "Ali" | "John" | "Bala" | "Yusoff"    from app_metadata.technician
 *   https://sejuk-ops/name, /email                                     for audit logs in the API
 */
exports.onExecutePostLogin = async (event, api) => {
  const ns = 'https://sejuk-ops'
  const roles = (event.authorization?.roles ?? []).map((r) => r.toLowerCase())
  const technician = event.user.app_metadata?.technician ?? null
  const name = event.user.name ?? event.user.nickname ?? null
  const email = event.user.email ?? null

  for (const token of [api.idToken, api.accessToken]) {
    token.setCustomClaim(`${ns}/roles`, roles)
    token.setCustomClaim(`${ns}/technician`, technician)
  }
  api.accessToken.setCustomClaim(`${ns}/name`, name)
  api.accessToken.setCustomClaim(`${ns}/email`, email)
}
