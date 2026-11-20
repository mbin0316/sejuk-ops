// Step 1 (interpret) and step 3 (format) of: question → interpret → controlled query → AI formats.
// The AI provider is Groq (GROQ_API_KEY) or Claude (ANTHROPIC_API_KEY). Rules and templates take
// over when neither is set or a call fails, so the window always answers.
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import {
  FLAG_ISSUES,
  PERIODS,
  QUERIES,
  RANKING_METRICS,
  interpretationSchema,
  type Interpretation,
  type Period,
  type QueryResult,
} from '../../shared/assistant.js'
import { ORDER_STATUSES } from '../../shared/orders.js'
import { z } from 'zod'

const MODEL = 'claude-opus-5-5'

let client: Anthropic | null = null
function claude() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 })
  return client
}

const MENU = Object.entries(QUERIES)
  .map(([name, what]) => `- ${name}: ${what}`)
  .join('\n')

const INTERPRET_SYSTEM = `You route questions from the operations team of Sejuk Sejuk Service, an aircon servicing company, to one controlled database query. You never answer the question yourself.

Queries you can choose:
${MENU}
- unsupported: anything the queries above can't answer (other topics, changing data, customer personal data, small talk).

Parameters (null when the question doesn't need or give them):
- technician: one of the technician names given below, exactly as written.
- period: ${PERIODS.join(', ')}. Weeks start on Monday. "this week" is this_week, "last week" is last_week, "recently" is last_7_days.
- status: ${ORDER_STATUSES.join(', ')}. "waiting for review" is job_done, "unassigned" is new, "ready to close" is reviewed.
- metric (technician_ranking only): ${RANKING_METRICS.join(', ')}. "most jobs" or "best" is completed; "most money" or "highest sales" is revenue.
- issue (flagged_jobs only): ${FLAG_ISSUES.join(', ')}, or null for all of them. "final much higher than quoted" is final_over_quote.
- orderNo (order_lookup only): the order number as written, e.g. ORDER0026.
- If the question names a technician who isn't in the list, still put that name in technician.
- period: only when the question states or clearly implies one; otherwise null (a sensible default is applied). Never assume today.

"How many jobs were completed today" is completed_jobs with period today. "Who is busiest / overloaded" is technician_workload.`

/** Step 1 with Claude: pick one query from the menu, as schema-validated JSON. */
async function interpretWithClaude(question: string, technicians: string[], today: string): Promise<Interpretation | null> {
  const c = claude()
  if (!c) return null
  const response = await c.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: 'low', format: zodOutputFormat(interpretationSchema) },
    system: INTERPRET_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Technicians: ${technicians.join(', ')}\nToday (Malaysia time): ${today}\n\nQuestion: ${question}`,
      },
    ],
  })
  if (response.stop_reason === 'refusal') return { ...EMPTY, query: 'unsupported' }
  return response.parsed_output ?? null
}

const STATUS_TEXT: Record<string, string> = {
  new: 'new', assigned: 'assigned', in_progress: 'in progress', job_done: 'job done, awaiting review', reviewed: 'reviewed', closed: 'closed',
}
const whenWithYear = (iso: unknown) =>
  new Date(String(iso)).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

/** Compact, human-readable version of a result for the formatter: Malaysia-time dates, at most 15 rows. */
function forAI(r: QueryResult) {
  const rows = r.rows.slice(0, 15).map((row) =>
    Object.fromEntries(
      r.columns
        .filter((c) => row[c.key] != null && c.label)
        .map((c) => [c.label, c.type === 'datetime' ? whenWithYear(row[c.key]) : c.type === 'money' ? rm(row[c.key]) : c.type === 'status' ? STATUS_TEXT[String(row[c.key])] ?? row[c.key] : row[c.key]]),
    ),
  )
  return JSON.stringify({
    title: r.title,
    period: r.periodLabel,
    facts: r.facts,
    rows,
    ...(r.rows.length > rows.length || r.truncated ? { moreRowsNotShown: true } : {}),
  })
}

const FORMAT_SYSTEM = `You are the operations assistant of Sejuk Sejuk Service, an aircon servicing company. Answer the manager's question using only the query result you are given. Never add facts that are not in it, and never guess.

- Start with one complete sentence that answers the question directly, e.g. "Ali completed 3 jobs last week, totalling RM 1,480.00." Never reply with a bare number or name.
- Then give the supporting detail: up to 8 items as short lines starting with "- ". If there are more, say how many more.
- Money is Malaysian ringgit: write "RM 1,250.00". Dates and times are already in Malaysia time: copy them as given.
- If the result is empty, say so plainly and mention the period it covered.
- Plain text only: no headings, tables, bold or code. At most about 120 words.
- Don't mention queries, JSON, databases or how you got the data.`

/** Step 3 with Claude: turn the structured result into a short answer. */
async function formatWithClaude(question: string, result: QueryResult): Promise<string | null> {
  const c = claude()
  if (!c) return null
  const response = await c.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: { effort: 'low' },
    system: FORMAT_SYSTEM,
    messages: [{ role: 'user', content: `Question: ${question}\n\nQuery result:\n${forAI(result)}` }],
  })
  if (response.stop_reason === 'refusal') return null
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  return text || null
}

/* ---------------------------------------------------------------------------
 * Groq (OpenAI-compatible chat completions), used when GROQ_API_KEY is set
 * ------------------------------------------------------------------------- */
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

/** JSON Schema for strict structured output (all fields required, nulls allowed). */
const INTERPRETATION_JSON_SCHEMA = (() => {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(interpretationSchema) as Record<string, unknown>
  return schema
})()

type GroqMessage = { role: 'system' | 'user'; content: string }

async function groq(messages: GroqMessage[], extra: Record<string, unknown>, retry = true): Promise<string | null> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: GROQ_MODEL, messages, reasoning_effort: 'low', ...extra }),
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string }
    choices?: { message?: { content?: string | null }; finish_reason?: string }[]
  }
  // Free tier: tokens per minute. Wait as Groq suggests (up to 8 s) and try once more.
  const wait = Number(res.headers.get('retry-after') ?? 0)
  if (res.status === 429 && retry && wait > 0 && wait <= 8) {
    await new Promise((r) => setTimeout(r, wait * 1000))
    return groq(messages, extra, false)
  }
  if (!res.ok) throw new Error(`Groq ${res.status}: ${body.error?.message ?? res.statusText}`)
  const choice = body.choices?.[0]
  if (choice?.finish_reason === 'length') throw new Error('Groq answer was cut off')
  return choice?.message?.content?.trim() || null
}

async function interpretWithGroq(question: string, technicians: string[], today: string): Promise<Interpretation | null> {
  const text = await groq(
    [
      { role: 'system', content: INTERPRET_SYSTEM },
      { role: 'user', content: `Technicians: ${technicians.join(', ')}\nToday (Malaysia time): ${today}\n\nQuestion: ${question}` },
    ],
    {
      max_completion_tokens: 1024,
      response_format: { type: 'json_schema', json_schema: { name: 'interpretation', strict: true, schema: INTERPRETATION_JSON_SCHEMA } },
    },
  )
  if (!text) return null
  // Validate again here: the model's choice is only used if it fits the menu exactly.
  const parsed = interpretationSchema.safeParse(JSON.parse(text))
  return parsed.success ? parsed.data : null
}

async function formatWithGroq(question: string, result: QueryResult): Promise<string | null> {
  return groq(
    [
      { role: 'system', content: FORMAT_SYSTEM },
      { role: 'user', content: `Question: ${question}\n\nQuery result:\n${forAI(result)}` },
    ],
    { max_completion_tokens: 2048 },
  )
}

/* ---------------------------------------------------------------------------
 * Provider choice: Groq if configured, else Claude, else none (rules + templates)
 * ------------------------------------------------------------------------- */

/** The model that will answer, or null when no AI key is configured. */
export function aiModel(): string | null {
  if (process.env.GROQ_API_KEY) return GROQ_MODEL
  if (process.env.ANTHROPIC_API_KEY) return MODEL
  return null
}

export function interpretWithAI(question: string, technicians: string[], today: string) {
  if (process.env.GROQ_API_KEY) return interpretWithGroq(question, technicians, today)
  return interpretWithClaude(question, technicians, today)
}

export function formatWithAI(question: string, result: QueryResult) {
  if (process.env.GROQ_API_KEY) return formatWithGroq(question, result)
  return formatWithClaude(question, result)
}

/* ---------------------------------------------------------------------------
 * Fallback: keyword rules and templates (no API key, API error, or refusal)
 * ------------------------------------------------------------------------- */

const EMPTY: Interpretation = { query: 'unsupported', technician: null, period: null, status: null, metric: null, issue: null, orderNo: null }

const PERIOD_WORDS: [RegExp, Period][] = [
  [/\byesterday\b/, 'yesterday'],
  [/\btoday\b/, 'today'],
  [/\blast week\b|\bprevious week\b/, 'last_week'],
  [/\bthis week\b|\bweekly\b/, 'this_week'],
  [/\blast month\b|\bprevious month\b/, 'last_month'],
  [/\bthis month\b|\bmonthly\b/, 'this_month'],
  [/\b(last|past) 30 days\b/, 'last_30_days'],
  [/\b(last|past) (7 days|few days)\b|\brecent(ly)?\b/, 'last_7_days'],
]

export function interpretWithRules(question: string, technicians: string[]): Interpretation {
  const q = question.toLowerCase()
  // A known name, else a name after "technician" or in "did X complete" (so unknown names get a clear answer).
  const technician =
    technicians.find((t) => new RegExp(`\\b${t.toLowerCase()}\\b`).test(q)) ??
    question.match(/\btechnician\s+([A-Z][a-z]+)/i)?.[1] ??
    question.match(/\b(?:did|has|is)\s+([A-Z][a-z]+)\s+(?:complete|finish|do|done|work)/)?.[1] ??
    null
  const period = PERIOD_WORDS.find(([re]) => re.test(q))?.[1] ?? null
  const orderNo = q.match(/\border\s*#?\s*(\d{1,8})\b/)?.[0] ?? null
  const base = { ...EMPTY, technician, period }

  if (orderNo) return { ...base, query: 'order_lookup', orderNo }
  if (/overload|workload|busiest|too many jobs|capacity/.test(q)) return { ...base, query: 'technician_workload' }
  if (/flag|suspicious|much higher|higher than quote|over the quote|no photo|without photo|not collected|unpaid|anomal/.test(q)) {
    const issue = /higher|over the quote|more than quote/.test(q)
      ? 'final_over_quote'
      : /photo/.test(q)
        ? 'no_photos'
        : /not collected|unpaid|payment/.test(q)
          ? 'payment_not_collected'
          : null
    return { ...base, query: 'flagged_jobs', issue }
  }
  if (/reschedul|postpon|delay/.test(q)) return { ...base, query: 'reschedules' }
  if (/\b(most|top|best|highest|rank|leader)/.test(q) && !technician) {
    const metric = /amount|money|revenue|sales|earn|bill/.test(q) ? 'revenue' : /reschedul|postpon/.test(q) ? 'reschedules' : 'completed'
    return { ...base, query: 'technician_ranking', metric }
  }
  if (/revenue|amount|money|sales|earn|bill|collected|payment|ringgit|\brm\b/.test(q)) return { ...base, query: 'revenue_summary' }
  if (/waiting for review|to review|pending review|awaiting review/.test(q)) return { ...base, query: 'open_jobs', status: 'job_done' }
  if (/ready to close|to close/.test(q)) return { ...base, query: 'open_jobs', status: 'reviewed' }
  if (/unassigned|not assigned|new order/.test(q)) return { ...base, query: 'open_jobs', status: 'new' }
  if (/in progress|working on|currently|right now|open jobs|pending|outstanding/.test(q))
    return { ...base, query: 'open_jobs', status: /in progress|working on/.test(q) ? 'in_progress' : null }
  if (/complet|finish|done|did\b/.test(q)) return { ...base, query: 'completed_jobs' }
  return base
}

const rm = (n: unknown) => `RM ${Number(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const when = (iso: unknown) =>
  new Date(String(iso)).toLocaleString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
const list = (lines: string[], max = 8) =>
  [...lines.slice(0, max).map((l) => `- ${l}`), ...(lines.length > max ? [`…and ${lines.length - max} more.`] : [])].join('\n')

/** Template answers, one per query, built only from the result. */
export function formatWithTemplate(r: QueryResult): string {
  const f = r.facts
  const rows = r.rows
  const period = r.periodLabel ?? ''
  switch (r.query) {
    case 'completed_jobs':
      if (!rows.length) return `No jobs were completed${r.params.technician ? ` by ${r.params.technician}` : ''} ${period}.`
      return `${f.jobsCompleted} ${f.jobsCompleted === 1 ? 'job was' : 'jobs were'} completed${r.params.technician ? ` by ${r.params.technician}` : ''} ${period}, totalling ${rm(f.totalAmount)}.\n${list(
        rows.map((x) => `${x.orderNo} · ${x.service} for ${x.customer}${x.technician && !r.params.technician ? ` (${x.technician})` : ''}, ${when(x.completedAt)}, ${rm(x.finalAmount)}`),
      )}`
    case 'technician_ranking': {
      const label = f.metric === 'revenue' ? 'total amount' : f.metric === 'reschedules' ? 'reschedules' : 'jobs completed'
      const value = (x: Record<string, unknown>) => (f.metric === 'revenue' ? rm(x.revenue) : String(f.metric === 'reschedules' ? x.reschedules : x.completed))
      if (!f.leaders) return `Nobody has any ${label} ${period} yet.`
      return `${f.leaders} ${String(f.leaders).includes(',') ? 'are' : 'is'} top for ${label} ${period}.\n${list(rows.map((x) => `${x.rank}. ${x.technician}: ${value(x)}`))}`
    }
    case 'open_jobs':
      if (!rows.length) return `There are no ${r.params.status ? `jobs with status "${r.params.status.replace('_', ' ')}"` : 'unfinished jobs'}${r.params.technician ? ` for ${r.params.technician}` : ''} right now.`
      return `${r.title}: ${rows.length}.\n${list(rows.map((x) => `${x.orderNo} · ${x.service} for ${x.customer}, ${x.technician}, ${String(x.status).replace('_', ' ')}`))}`
    case 'technician_workload':
      return `${f.overloaded ? `${f.overloaded} ${String(f.overloaded).includes(',') ? 'look' : 'looks'} overloaded.` : 'Nobody looks overloaded right now.'} Average ${f.averageOpenJobs} open jobs per technician; ${f.unassignedOrders} unassigned.\n${list(
        rows.map((x) => `${x.technician}: ${x.open} open (${x.assigned} assigned, ${x.inProgress} in progress)`),
      )}`
    case 'reschedules':
      if (!rows.length) return `No visits were rescheduled ${period}.`
      return `${f.count} ${f.count === 1 ? 'visit was' : 'visits were'} rescheduled ${period}.\n${list(rows.map((x) => `${x.orderNo} (${x.customer}), ${x.technician}: ${x.reason ?? 'no reason given'}${x.newDate ? `, new date ${x.newDate}` : ''}`))}`
    case 'revenue_summary':
      return `${rm(f.totalFinalAmount)} from ${f.jobsCompleted} completed ${f.jobsCompleted === 1 ? 'job' : 'jobs'} ${period}, including ${rm(f.totalExtraCharges)} extra charges. Collected ${rm(f.paymentCollected)}; ${f.jobsNotYetPaid} not yet paid.\n${list(
        rows.filter((x) => Number(x.completed) > 0).map((x) => `${x.technician}: ${rm(x.revenue)} from ${x.completed} jobs`),
      )}`
    case 'order_lookup': {
      const x = rows[0]
      if (!x) return `I couldn't find ${r.params.orderNo}.`
      return `${x.orderNo} is ${String(x.status).replace('_', ' ')}: ${x.service} for ${x.customer}, technician ${x.technician}. Quoted ${rm(x.quoted)}${x.finalAmount != null ? `, final ${rm(x.finalAmount)}` : ''}.${x.lastAction ? ` Last: ${String(x.lastAction).replace('_', ' ')}, ${when(x.lastActionAt)}.` : ''}`
    }
    case 'flagged_jobs':
      if (!rows.length) return `None. ${r.title}: 0.`
      return `${r.title}: ${f.flaggedJobs}.\n${list(rows.map((x) => `${x.orderNo} (${x.customer}, ${x.technician}): ${x.issues}`))}`
  }
}
