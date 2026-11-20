import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { requireAuth, type AuthEnv } from './auth.js'
import { assistantRoutes } from './routes/assistant.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { jobRoutes } from './routes/jobs.js'
import { orderRoutes, reviewRoutes, technicianRoutes } from './routes/orders.js'

/**
 * Single Hono app that serves every /api/* route.
 * Vercel Hobby allows 12 functions per deployment, so all endpoints live in
 * one function (api/index.ts) and are routed here instead of one file per route.
 */
export const app = new Hono<AuthEnv>().basePath('/api')

// ---- Public ----
app.get('/health', (c) =>
  c.json({
    ok: true,
    service: 'sejuk-ops-api',
    time: new Date().toISOString(),
  }),
)

// ---- Everything registered below requires a valid Auth0 access token ----
// (Hono runs handlers in registration order, so /health above never reaches this.)
app.use('*', requireAuth)

/** Who am I, according to the verified token. */
app.get('/me', (c) => c.json({ user: c.get('user') }))

app.route('/technicians', technicianRoutes)
app.route('/orders', orderRoutes)
app.route('/dashboard', dashboardRoutes)
app.route('/jobs', jobRoutes)
app.route('/review', reviewRoutes)
app.route('/assistant', assistantRoutes)

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    // Validation errors carry their own response (message + per-field messages).
    return err.res ? err.getResponse() : c.json({ error: err.message }, err.status)
  }
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})
