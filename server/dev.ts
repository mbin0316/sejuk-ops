import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'

// Load server-side secrets for local dev (Vercel injects them in production).
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file)
}

const { app } = await import('./app.js')

const port = Number(process.env.API_PORT ?? 8787)
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}/api`)
})
