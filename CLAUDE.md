# Sejuk Ops

Programmer assessment: internal operations system for Sejuk Sejuk Service (fictional aircon company).
Workflow: Order → Assignment → Service Completion → Manager / Accounts Review, plus an AI operations query window.

## Source of truth
- **Domain, data and features follow the assessment brief strictly**: individual technicians (Ali, John, Bala, Yusoff), order fields, `ORDER####` order numbers, and the six statuses `new → assigned → in_progress → job_done → reviewed → closed`.
- **`design/` is UI/UX guidance only** (look, layout, components). Its sample data (teams like "Team KL-03", `SJ-1042` job IDs, branch filters, extra screens) is not a requirement.

## UI/UX
- Follow `design/DESIGN.md` for all UI: colours, type, radius, components, layout.
- Use the tokens defined in `src/index.css` (`@theme`, copied from `design/tokens/`). Never hard-code colours outside them.
- Visual references: `design/screens/*.png` (exact styles in the HTML next to each).
- Status colours come from `STATUS_TONE` in `src/lib/domain.ts`, which maps the six statuses onto the design's status table:
  New = neutral, Assigned / In progress = accent, Job done = warning, Reviewed / Closed = success. Always show the text label.
- Lexend, weights 400 and 500 only. Sentence case. Outline icons (lucide, 1.8 stroke).
- Desktop app (admin + manager) is one shell with role-based nav. Technician app is mobile-first (390px), touch targets ≥ 44px (actions 52px).

## Architecture
- React 19 + Vite + TS + Tailwind v4 SPA in `src/`.
- All data goes through `/api` (Hono in `server/app.ts`, one Vercel function `api/index.ts`). The browser never talks to Supabase directly.
- Auth: Auth0 with RBAC roles (admin, technician, manager) via a namespaced token claim; the API verifies the JWT and enforces workflow rules.
- `npm run dev` runs web (:5173) and API (:8787, proxied at /api).
