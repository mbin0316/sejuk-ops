# Sejuk Sejuk Ops

Internal operations system for Sejuk Sejuk Service, a fictional air-conditioner service company. It runs the whole job workflow, **Order → Assignment → Service Completion → Manager / Accounts Review**, and adds a KPI dashboard and an AI operations assistant.

- **Live demo:** _add the Vercel URL here_
- **Demo accounts:** listed on the sign-in page under **For reviewers**. There's one shared password for all six accounts.

| Account | Role | Try |
|---|---|---|
| `admin@sejuk-ops.com` | Admin | Create an order, assign a technician, send the job by WhatsApp |
| `manager@sejuk-ops.com` | Manager | Dashboard, review and close jobs, AI assistant |
| `ali@sejuk-ops.com`, `john@…`, `bala@…`, `yusoff@…` | Technician | Phone view: start, reschedule, complete with photos |

---

## Contents

1. [What was built](#what-was-built)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [Workflow and rules](#workflow-and-rules)
5. [Modules](#modules)
6. [How AI is integrated](#how-ai-is-integrated)
7. [Architecture decisions](#architecture-decisions)
8. [Assumptions](#assumptions)
9. [Limitations](#limitations)
10. [Run locally](#run-locally)
11. [Deploy](#deploy)
12. [Project layout](#project-layout)
13. [Self-assessment](#self-assessment)

---

## What was built

| Brief | Status | Where |
|---|---|---|
| Module 1: Admin portal, create order (auto Order No, customer, phone, address, problem, service type, quoted price, technician, admin notes) | Done | `/orders/new` |
| Bonus: order summary after submit, WhatsApp to technician | Done | Summary screen after saving |
| Module 2: Technician portal (mobile): work done, extra charges, up to 6 uploads, auto final amount, remarks, payment | Done | `/tech/jobs` |
| Module 3: WhatsApp trigger on Job Done | Done (wa.me link) | Technician job page after completion |
| Module 4: Manager / accounts review | Done | `/review` and the order page |
| Six statuses with rules (only admin assigns, only the assigned technician completes, traceable actions) | Done, enforced by the API | Every order's **History** |
| KPI dashboard (bonus): per technician jobs completed, total amount, reschedules; leaderboard; charts; weekly at minimum | Done | `/overview` |
| AI operations query window, controlled queries only | Done | `/assistant` |
| Optional AI: workflow supervisor (final much higher than quoted, no photos) | Partly: rule-based flags plus an AI query | Review queue badges, `flagged_jobs` query |
| Optional AI: operational insight (overloaded technician) | Done | Dashboard, `technician_workload` query |
| Optional AI: document understanding | Not done | |

## Tech stack

| Layer | Tool |
|---|---|
| Front-end | React 19, Vite, TypeScript, Tailwind CSS v4, React Router, TanStack Query, React Hook Form + Zod |
| API | Hono on one Vercel Node.js function (`api/index.ts`) |
| Auth | Auth0: Universal Login, RBAC roles, JWT verified by the API |
| Database and files | Supabase Postgres and Storage (private bucket), accessed only by the API |
| AI | Groq `openai/gpt-oss-120b` (structured JSON output), or Claude `claude-opus-5-5`, over a fixed set of queries |
| Hosting | Vercel |

## Architecture

```
 Browser (React SPA)                         Vercel function: /api (Hono)                    Supabase
 ───────────────────                         ────────────────────────────                    ────────
 Admin / Manager desktop  ──┐                 1. verify Auth0 JWT (JWKS)                      Postgres
 Technician phone view    ──┼─ HTTPS + JWT ─▶ 2. check role                    ── service ──▶ orders, job_reports,
                            │                 3. check workflow rules             key         attachments,
 Auth0 Universal Login ◀────┘                 4. read / write + audit event                   order_events,
   (roles in token claims)                                                                    technicians
                                              /api/assistant ── fixed queries ─┐
                                                     │                         │              Storage
                                                     └── Groq / Claude ◀───────┘              job-files (private)
                                                         (interpret + format only)                ▲
 File bytes ── one-time signed upload URL (issued by the API, one path per file) ─────────────────┘
```

- **One API, one function:** every `/api/*` request is rewritten to `api/index.ts`, and Hono routes it. That keeps all the rules in one place and stays within the free Vercel plan's function limit.
- **The browser never queries Supabase.** Every table has RLS on with no policies, and the public roles have no table grants. Only the API's server-side key can read or write. The one exception is file bytes, explained under [decisions](#architecture-decisions).
- **Shared rules:** `shared/` holds the statuses, service types, Zod validation and response types used by both the React app and the API. A form and its endpoint can't disagree.

## Workflow and rules

```
New ──assign──▶ Assigned ──start──▶ In progress ──complete──▶ Job done ──review──▶ Reviewed ──close──▶ Closed
 (admin)          ▲   (assigned tech)     │      (assigned tech)          (manager)            (manager)
                  └────── reschedule ─────┘
```

| Action | Who | Allowed from | Checked by |
|---|---|---|---|
| Create order | Admin | | API (role) |
| Assign / reassign technician | Admin only | New, Assigned (before work starts) | API, guarded on status in the UPDATE |
| Start job | The assigned technician | Assigned | API (role, ownership, status) |
| Reschedule visit (reason, optional new date) | The assigned technician | Assigned, In progress → back to Assigned | API |
| Complete job (service report and files) | The assigned technician only | In progress | API, including checking that each file is in that order's storage folder |
| Review | Manager | Job done | API |
| Close | Manager | Reviewed | API |

- **Traceability:** every action writes an `order_events` row with who, role, from status, to status, details and time. It shows as **History** on each order and as **Recent activity** on the dashboard.
- **Race safety:** status changes run as `UPDATE … WHERE status = <expected>`. If a job changed in the meantime, for example it was started just as the admin reassigned it, the request returns **409** instead of overwriting.
- **Privacy between technicians:** a technician asking for someone else's order gets the same **404** as a missing order.

## Modules

### Admin portal (`/orders`, `/orders/new`, `/orders/:id`)
- **Job orders:** search by order no., customer name or phone digits; filter by status and technician. Managers see it read-only.
- **New order:** every field in the brief, validated by the same Zod schema as the API. Order numbers (`ORDER0001`, …) come from a database sequence. An order with a technician starts as **Assigned**; one without starts as **New**.
- **After saving:** an order summary with a **WhatsApp {technician}** button. It opens a `wa.me` link with the job details already written.
- **Order page:** progress through the 6 steps, customer and job details, the service report with files, assign or reassign, a call button, and the full history.

### Technician portal (`/tech/jobs`, mobile-first at 390px)
- **Today:** "2 of 5 jobs done", the next job card with **Call**, **Navigate** (Google Maps) and **Start job**, then the queue and the jobs done this week.
- **Service report** (while in progress):
  - work done and extra charges
  - the **final amount**, worked out live as quoted + extra (the server computes it again)
  - remarks, and payment method and amount (defaults to the final amount)
  - **up to 6** photos, videos (MP4, MOV) or PDFs, 20 MB each, uploaded as soon as they're picked, with a preview
- **Job done:** a **WhatsApp customer** button with the job summary and total (the brief's WhatsApp trigger).

### Manager review (`/review`)
- Two tabs: **Waiting for review** (oldest first) and **Ready to close**.
- Each card shows the work done, quote, extra charges, final amount and payment collected, with badges for things to check:
  - extra charges over the quote
  - payment not collected
  - amount collected differs from the final amount
  - waiting over 48 hours
  - rescheduled
  - no photos
- **Mark reviewed** and **Close order** are on the card, and on the order page with an optional note that goes into the history.

### KPI dashboard (`/overview`, home page for admin and manager)
- Period toggle: **7 days** (default), 30 days, or 3 months (weekly bars). All in Malaysia time.
- **Technician leaderboard:** jobs completed, total amount (sum of final amounts) and reschedules in the period, plus open jobs right now.
- **Service performance chart:** completed jobs per day going up, rescheduled visits going down. It has hover tooltips and a table version for screen readers.
- Jobs by status, open orders, completed today vs yesterday, total amount vs the previous period, recent activity, and jobs waiting for review.

### AI assistant (`/assistant`, admin and manager)
See [How AI is integrated](#how-ai-is-integrated).

## How AI is integrated

The brief requires this flow: question → interpret → database retrieves → AI formats. It also requires no unrestricted database access.

1. **Interpret:** the model returns **structured JSON**, validated twice: by the provider's strict JSON schema and again with Zod on the server. The JSON chooses **one query from a fixed menu of 8**, or `unsupported`, plus its filters: technician, period, status, metric, issue or order no. ([shared/assistant.ts](shared/assistant.ts)).
2. **Retrieve:** the API runs that query's own **fixed, parameterised code** ([server/assistant/queries.ts](server/assistant/queries.ts)).
   - The model never writes SQL, never sees credentials, and cannot change data.
   - Technician names are matched against the real list ("There's no technician called Siti").
   - Periods are resolved in Malaysia time, with weeks starting on Monday.
3. **Format:** the model writes a short answer from a **compact copy of that result only**: at most 15 rows, with dates already in Malaysia time. Under each answer, **Show the data** lists the query, its filters and the rows behind it, so every number can be checked.

| Query | Example questions |
|---|---|
| `completed_jobs` | What jobs did technician Ali complete last week? How many jobs were completed today? |
| `technician_ranking` | Which technician completed the most jobs this week? Who billed the most this month? |
| `open_jobs` | Which jobs are waiting for review? What is Bala working on? |
| `technician_workload` | Which technician is overloaded right now? |
| `reschedules` | Who rescheduled visits in the last 30 days, and why? |
| `revenue_summary` | How much did we bill this month? |
| `order_lookup` | What's the status of ORDER0026? |
| `flagged_jobs` | Any completed jobs with a final amount much higher than quoted? Jobs without photos? |

- **Out of scope:** requests like "delete all orders" or "list every customer's phone number" get a polite "I can only answer…" with example questions.
- **Provider:** Groq (`openai/gpt-oss-120b`) when `GROQ_API_KEY` is set, otherwise Claude (`claude-opus-5-5`) when `ANTHROPIC_API_KEY` is set.
- **Fallback:** with no key, or if a call fails (for example Groq's free tier allows 8,000 tokens a minute; the app retries once after Groq's suggested wait), keyword rules pick the query and a template writes the answer. The page says which path answered.
- **Workflow supervisor and operational insight** (optional brief items):
  - The review queue flags "extra charges over the quote" and "no photos" on each job.
  - The `flagged_jobs` query finds jobs whose final amount is at least 1.5× the quote and RM 100 or more above it, jobs without photos, and unpaid jobs.
  - `technician_workload` flags a technician as overloaded at 3 or more open jobs and at least twice the team average.

## Architecture decisions

- **Auth0 instead of Supabase Auth.** Roles are Auth0 RBAC roles, copied into namespaced token claims by a Post-Login Action ([auth0/post-login-action.js](auth0/post-login-action.js)). The SPA uses the ID token only to pick the right portal. The API trusts only the access token, verified against Auth0's JWKS (signature, issuer, audience, expiry).
- **All data through one API.** Workflow rules, ownership checks and the audit trail live in one place (`server/`) and can't be bypassed from the browser. The cost is one more hop than querying Supabase directly, which is fine at this scale.
- **Uploads go straight to Storage through signed URLs.** Vercel functions cap request bodies at about 4.5 MB, which phone photos and videos often exceed.
  - The API issues a **one-time signed upload URL per file**, only for the order's own folder and only while the job is in progress.
  - The browser sends the bytes directly to the **private** bucket.
  - On submit, the API checks that each file exists in that order's folder before saving the report.
  - Files are viewed through 1-hour signed links.
- **WhatsApp through `wa.me` links.** No business account, templates or per-message cost, and it matches the brief. The trade-off is that a person presses **Send**. The automatic option would be Meta's WhatsApp Cloud API: approved templates, a verified sender number and server-side secrets.
- **The AI chooses, the server runs.** The model only fills a strict schema, so the worst a bad answer can do is choose the wrong query from the menu. The rows behind every answer are shown, so a reviewer can check it.
- **Shared Zod schemas** in `shared/` for forms and endpoints, and **design tokens** from `design/` in Tailwind's `@theme`, so colours, type and radius stay consistent.

## Assumptions

- Technicians are individuals (Ali, John, Bala, Yusoff), as the brief says, not teams. Each job has one technician.
- The admin sets the quoted price. **Final amount = quoted price + extra charges**, computed by the server.
- Payment can be recorded at completion or left "not collected". The review queue flags unpaid jobs.
- "Manager / accounts review" is one **manager** role that reviews and then closes. Closing means payment and paperwork are confirmed.
- **Rescheduling** keeps the same technician, puts the job back to **Assigned**, and counts toward the KPI. The new date is stored with the reason in the history; there's no calendar.
- The technician can only be reassigned **before work starts**.
- Phone numbers are Malaysian. For WhatsApp, a leading `0` becomes `60`.
- Times are Malaysia time (UTC+8), and weeks start on Monday.
- Order numbers continue from `ORDER0001` and are never reused.

## Limitations

- **No automated test suite.** Each phase was checked with scripted API runs against the real database (guards, ownership, status races, uploads) and by hand in the browser for each role. These aren't packaged as `npm test`.
- **WhatsApp isn't sent automatically.** `wa.me` opens a pre-filled chat; a person sends it.
- **No scheduling.** There are no visit times or calendar, so a reschedule's new date is only noted in the history.
- **No admin screens for users or technicians.** Accounts are managed in Auth0 and technicians in the database.
- **The order list shows the newest 300 orders** without pagination. The dashboard aggregates in the function, which is fine for this size of data.
- **A file removed before submitting** stays in Storage as an unlinked object.
- **The AI answers one question at a time**, with no follow-ups like "and last week?". Groq's free tier allows about 5 questions a minute before the app falls back to keyword answers.
- **Shared demo password.** It's shown on the sign-in page for reviewers, so anyone with the link can change demo data. Reset it with `select seed_demo_data();` in Supabase.
- **Free Supabase projects pause** after a week without activity.
- **Document understanding** (an optional AI item) isn't implemented.

## Run locally

Needs Node 20+, an Auth0 tenant and a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # web on :5173, API on :8787 (proxied at /api)
```

1. **Auth0:** follow [docs/auth0-setup.md](docs/auth0-setup.md). It covers the SPA app, the API, roles, the Post-Login Action and the demo users.
2. **Supabase:** follow [docs/supabase-setup.md](docs/supabase-setup.md). Run `supabase/schema.sql`, then `supabase/seed.sql`, which loads 26 demo orders over the last three weeks.
3. **AI (optional):** set `GROQ_API_KEY` (or `ANTHROPIC_API_KEY`). Without one, the assistant uses keyword rules.

| Variable | Where | Purpose |
|---|---|---|
| `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE` | Browser | Auth0 sign-in |
| `VITE_DEMO_PASSWORD` | Browser | Shared demo password shown in the reviewers' notice |
| `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` | Server | JWT verification |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server | Database and Storage (never exposed to the browser) |
| `GROQ_API_KEY`, `GROQ_MODEL` | Server | AI assistant (Groq) |
| `ANTHROPIC_API_KEY` | Server | AI assistant (Claude, used if Groq isn't set) |

Other scripts: `npm run build` (typecheck and production build), `npm run typecheck`, `npm run lint`.

## Deploy

1. Import the GitHub repo into **Vercel**. The framework preset is Vite; `vercel.json` already routes `/api/*` to the function and everything else to the SPA.
2. Add every variable from the table above in **Project Settings → Environment Variables**, then deploy.
3. In **Auth0 → Applications → Sejuk Ops → Settings**, add the Vercel URL (e.g. `https://sejuk-ops.vercel.app`) to **Allowed Callback URLs**, **Allowed Logout URLs** and **Allowed Web Origins**, then save.

## Project layout

```
api/index.ts            Vercel function entry (every /api/* is rewritten here)
server/app.ts           Hono app: auth middleware and route mounting
server/auth.ts          Auth0 JWT verification and role checks
server/routes/          orders (admin + review), jobs (technician), dashboard, assistant
server/assistant/       AI interpret/format (Groq, Claude, rules), fixed queries, periods
shared/                 Statuses, Zod schemas and API types used by app and API
src/pages/desk/         Admin and manager pages (orders, overview, review, assistant)
src/pages/tech/         Technician pages (job list, job page)
src/components/         UI kit from design/ (buttons, cards, badges, shells)
supabase/               schema.sql (tables, RLS, grants, storage) and seed.sql (demo data)
auth0/                  Post-Login Action that puts roles in the tokens
docs/                   Auth0 and Supabase setup guides
design/                 UI/UX guidance (tokens, screens)
```

## Self-assessment

### What works well

- **The whole workflow runs end to end.** An order can go from New to Closed, and every step is saved to `order_events`, so you can see who did what and when.
- **The rules live in the API, not just the UI.** A button being hidden isn't what stops someone. The server checks the role, who owns the job and the current status on every request. For example, only the assigned technician can complete a job. See [server/routes/](server/routes/).
- **The AI can't touch the database.** It only picks a query from a fixed list of 8. The server runs that query and gives the AI the results to word the answer. If there's no AI key, keyword rules and templates answer instead. See [server/assistant/](server/assistant/).
- **One codebase for both screens.** A desktop app for the office and a phone view for technicians, sharing the same components and design tokens.

### Trade-offs

| Choice | Why | Cost |
|---|---|---|
| WhatsApp through `wa.me` links | It's what the brief asks for. No business account or paid API needed. | Someone still has to press **Send**. |
| The browser uploads files directly to Storage (signed URLs) | Vercel caps a request at about 4.5 MB, and phone photos and videos are often bigger. | It's the one place the browser talks to Supabase. Each URL works once, for one file in that order's folder. |
| Scripted checks instead of a test suite | Not enough time to write proper tests. Each phase was checked with scripts against the real database, and by hand in the browser. | No `npm test`, so changes have to be rechecked by hand. |

### Next steps

1. **Tests:** API tests for each workflow rule, and one Playwright test that takes an order from New to Closed.
2. **Scheduling:** give each visit a date and time slot, so a reschedule moves a real appointment.
3. **AI:** a supervisor summary on the dashboard, and reading details from uploaded receipts or quotation PDFs.
4. **Admin tools:** screens to manage technicians and users, and pagination for the order list.
