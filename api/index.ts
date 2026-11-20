import { app } from '../server/app.js'

// Vercel Node.js function. vercel.json rewrites every /api/* request here,
// and Hono routes on the original path.
const handler = (req: Request) => app.fetch(req)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
