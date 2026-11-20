import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
  EXAMPLE_QUESTIONS,
  askSchema,
  type AssistantAnswer,
  type Interpretation,
  type QueryName,
} from '../../shared/assistant.js'
import { aiModel, formatWithAI, formatWithTemplate, interpretWithAI, interpretWithRules } from '../assistant/ai.js'
import { dayKey } from '../assistant/period.js'
import { runQuery, technicianNames } from '../assistant/queries.js'
import { requireRole, type AuthEnv } from '../auth.js'
import { parseOr400, readJson } from './orders.js'

export const assistantRoutes = new Hono<AuthEnv>()

const UNSUPPORTED = `I can only answer questions about jobs, technicians and amounts from the job records. Try one of these:\n${EXAMPLE_QUESTIONS.slice(0, 4)
  .map((q) => `- ${q}`)
  .join('\n')}`

/**
 * POST /api/assistant { question }: AI operations query window.
 * question → interpret (AI picks one controlled query, or keyword rules) → run that query → format (AI, or a template).
 */
assistantRoutes.post('/', requireRole('admin', 'manager'), async (c) => {
  const { question } = parseOr400(askSchema, await readJson(c))
  const technicians = await technicianNames()

  let interpretation: Interpretation | null = null
  const model = aiModel()
  let interpretSource: AssistantAnswer['source']['interpret'] = 'ai'
  try {
    if (model) interpretation = await interpretWithAI(question, technicians, dayKey(new Date()))
  } catch (err) {
    console.error('[assistant] interpret failed, using rules:', err instanceof Error ? err.message : err)
  }
  if (!interpretation) {
    interpretation = interpretWithRules(question, technicians)
    interpretSource = 'rules'
  }

  if (interpretation.query === 'unsupported') {
    const body: AssistantAnswer = { answer: UNSUPPORTED, source: { interpret: interpretSource, format: 'template', model: interpretSource === 'ai' ? model : null }, result: null }
    return c.json(body)
  }

  let result
  try {
    result = await runQuery(interpretation as Interpretation & { query: QueryName })
  } catch (err) {
    // A bad parameter (unknown technician or order no.) becomes a friendly answer, not an error.
    if (err instanceof HTTPException && err.status === 400) {
      const body: AssistantAnswer = { answer: err.message, source: { interpret: interpretSource, format: 'template', model: interpretSource === 'ai' ? model : null }, result: null }
      return c.json(body)
    }
    throw err
  }

  let answer: string | null = null
  let formatSource: AssistantAnswer['source']['format'] = 'ai'
  if (interpretSource === 'ai') {
    try {
      answer = await formatWithAI(question, result)
    } catch (err) {
      console.error('[assistant] format failed, using template:', err instanceof Error ? err.message : err)
    }
  }
  if (!answer) {
    answer = formatWithTemplate(result)
    formatSource = 'template'
  }

  const body: AssistantAnswer = {
    answer,
    source: { interpret: interpretSource, format: formatSource, model: interpretSource === 'ai' ? model : null },
    result,
  }
  return c.json(body)
})
