// AI operations query window: the fixed menu of controlled queries and the answer shape.
// The AI only chooses a query and its parameters from this menu; the API runs the query.
import { z } from 'zod'
import { ORDER_STATUSES } from './orders.js'

export const PERIODS = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'last_7_days',
  'last_30_days',
] as const
export type Period = (typeof PERIODS)[number]

export const RANKING_METRICS = ['completed', 'revenue', 'reschedules'] as const
export type RankingMetric = (typeof RANKING_METRICS)[number]

export const FLAG_ISSUES = ['final_over_quote', 'no_photos', 'payment_not_collected'] as const
export type FlagIssue = (typeof FLAG_ISSUES)[number]

/** The controlled queries. Each one is a fixed, parameterised read in server/assistant/queries.ts. */
export const QUERIES = {
  completed_jobs: 'Jobs marked done in a period, optionally for one technician (lists them and counts them).',
  technician_ranking: 'Technicians ranked by jobs completed, total amount, or reschedules in a period.',
  open_jobs: 'Current jobs by status (default: not finished yet), optionally for one technician.',
  technician_workload: 'Open jobs per technician right now, to spot who is overloaded.',
  reschedules: 'Visits postponed in a period, with reasons, optionally for one technician.',
  revenue_summary: 'Total final amount, extra charges and payment collected in a period, per technician.',
  order_lookup: 'Status and details of one order by its number, e.g. ORDER0026.',
  flagged_jobs: 'Completed jobs needing attention in a period: final much higher than quoted, no photos, or payment not collected.',
} as const
export type QueryName = keyof typeof QUERIES
export const QUERY_NAMES = Object.keys(QUERIES) as QueryName[]

/** What the interpreter must return: one query from the menu (or "unsupported") and its parameters. */
export const interpretationSchema = z.object({
  query: z.enum([
    'completed_jobs',
    'technician_ranking',
    'open_jobs',
    'technician_workload',
    'reschedules',
    'revenue_summary',
    'order_lookup',
    'flagged_jobs',
    'unsupported',
  ] satisfies (QueryName | 'unsupported')[]),
  technician: z.string().nullable(),
  period: z.enum(PERIODS).nullable(),
  status: z.enum(ORDER_STATUSES).nullable(),
  metric: z.enum(RANKING_METRICS).nullable(),
  issue: z.enum(FLAG_ISSUES).nullable(),
  orderNo: z.string().nullable(),
})
export type Interpretation = z.infer<typeof interpretationSchema>

export const askSchema = z.object({
  question: z.string().trim().min(3, 'Type a question').max(300, 'Keep the question under 300 characters'),
})

export type ColumnType = 'text' | 'number' | 'money' | 'datetime' | 'status'
export type Column = { key: string; label: string; type: ColumnType }
export type Cell = string | number | null

/** Structured result of one controlled query. This, not the database, is what the formatter sees. */
export type QueryResult = {
  query: QueryName
  /** Normalised parameters actually used, e.g. { technician: "Ali", period: "last_week" }. */
  params: Record<string, string | null>
  title: string
  /** Human label for the period, with dates, e.g. "last week (9–15 Nov)". */
  periodLabel: string | null
  facts: Record<string, Cell>
  columns: Column[]
  rows: Record<string, Cell>[]
  /** True if more rows matched than were returned. */
  truncated: boolean
}

export type AssistantAnswer = {
  answer: string
  /** Who interpreted the question and who wrote the answer; `model` is the AI model when one was used. */
  source: { interpret: 'ai' | 'rules'; format: 'ai' | 'template'; model: string | null }
  result: QueryResult | null
}

export const EXAMPLE_QUESTIONS = [
  'What jobs did technician Ali complete last week?',
  'Which technician completed the most jobs this week?',
  'How many jobs were completed today?',
  'Which technician is overloaded right now?',
  'How much did we bill this month?',
  'Which jobs are waiting for review?',
  'Who rescheduled visits in the last 30 days, and why?',
  'Any completed jobs with a final amount much higher than quoted this month?',
]
