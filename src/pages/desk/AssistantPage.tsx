import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowUp, Database, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { EXAMPLE_QUESTIONS, type AssistantAnswer, type Cell, type Column, type QueryResult } from '../../../shared/assistant.ts'
import type { OrderStatus } from '../../../shared/orders.ts'
import { PageHeader } from '../../components/PageHeader.tsx'
import { Card, NavyPanel, StatusBadge } from '../../components/ui.tsx'
import { apiFetch } from '../../lib/api.ts'
import { ORDER_STATUSES } from '../../lib/domain.ts'
import { formatDateTime, formatMoney } from '../../lib/format.ts'

type Turn = { id: number; question: string; reply?: AssistantAnswer; error?: string }

/** AI operations query window: question → interpret → controlled query → AI-formatted answer. */
export function AssistantPage() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  const ask = useMutation({
    mutationFn: (question: string) => apiFetch<AssistantAnswer>('/assistant', { method: 'POST', body: JSON.stringify({ question }) }),
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns])

  function send(question: string) {
    const q = question.trim()
    if (q.length < 3 || ask.isPending) return
    const id = nextId.current++
    setTurns((t) => [...t, { id, question: q }])
    setDraft('')
    ask.mutate(q, {
      onSuccess: (reply) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, reply } : x))),
      onError: (err) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: err.message } : x))),
    })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(draft)
  }

  return (
    <>
      <PageHeader title="AI assistant" subtitle="Ask about jobs, technicians and amounts. Answers come from the job records only." />

      <div className="grid items-start gap-4 dash:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Card className="flex min-h-[560px] flex-col gap-4">
          <div className="flex flex-1 flex-col gap-5" aria-live="polite">
            {turns.length === 0 ? (
              <div className="flex flex-1 flex-col items-start justify-center gap-4">
                <span className="flex size-11 items-center justify-center rounded-btn bg-accent-tint text-accent-text">
                  <Sparkles className="size-5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-heading font-medium text-ink">What would you like to know?</h2>
                  <p className="mt-1 text-body-sm text-ink-muted">Try one of these, or type your own question.</p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {EXAMPLE_QUESTIONS.slice(0, 6).map((q) => (
                    <li key={q}>
                      <SuggestionButton text={q} onPick={send} disabled={ask.isPending} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              turns.map((t) => <TurnView key={t.id} turn={t} />)
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-line pt-4">
            <label htmlFor="assistant-question" className="sr-only">
              Your question
            </label>
            <textarea
              id="assistant-question"
              rows={1}
              maxLength={300}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send(draft)
                }
              }}
              placeholder="e.g. Which technician completed the most jobs this week?"
              className="max-h-32 min-h-12 flex-1 resize-none rounded-input border border-line bg-surface px-3 py-3 text-body text-ink placeholder:text-ink-muted focus:border-accent-strong focus:outline-2 focus:outline-offset-0 focus:outline-accent-tint"
            />
            <button
              type="submit"
              aria-label="Ask"
              disabled={draft.trim().length < 3 || ask.isPending}
              className="flex size-12 shrink-0 items-center justify-center rounded-btn bg-accent-strong text-white transition-colors hover:bg-accent-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowUp className="size-5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </form>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <NavyPanel>
            <h2 className="text-heading font-medium">How it answers</h2>
            <ol className="mt-4 flex flex-col gap-3 text-body-sm text-on-navy-soft">
              {[
                ['Interpret', 'The AI reads your question and picks one query from a fixed list, with its filters.'],
                ['Retrieve', 'The server runs that query on the job records. The AI never touches the database.'],
                ['Answer', 'The AI writes the answer from those results only. Expand "Show the data" to check it.'],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-800 text-caption text-on-navy">{i + 1}</span>
                  <span>
                    <span className="font-medium text-on-navy">{title}.</span> {text}
                  </span>
                </li>
              ))}
            </ol>
          </NavyPanel>
          <Card>
            <h2 className="text-heading-sm font-medium text-ink">More to try</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {EXAMPLE_QUESTIONS.slice(3).map((q) => (
                <li key={q}>
                  <SuggestionButton text={q} onPick={send} disabled={ask.isPending} block />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}

function SuggestionButton({ text, onPick, disabled, block }: { text: string; onPick: (q: string) => void; disabled: boolean; block?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onPick(text)}
      disabled={disabled}
      className={clsx(
        'min-h-11 rounded-btn border border-line bg-surface px-3.5 py-2 text-left text-body-sm text-ink transition-colors hover:border-accent-strong hover:bg-accent-tint disabled:opacity-50',
        block && 'w-full',
      )}
    >
      {text}
    </button>
  )
}

function TurnView({ turn }: { turn: Turn }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[85%] self-end rounded-card rounded-br-[6px] bg-navy-900 px-4 py-2.5 text-body-sm text-white">{turn.question}</p>
      {turn.reply ? (
        <Reply reply={turn.reply} />
      ) : turn.error ? (
        <p role="alert" className="max-w-[90%] rounded-card bg-danger-tint px-4 py-3 text-body-sm text-danger-text">
          Sorry, that didn't work: {turn.error}
        </p>
      ) : (
        <p className="flex items-center gap-2 text-body-sm text-ink-muted" role="status">
          <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
          Looking it up…
        </p>
      )}
    </div>
  )
}

function Reply({ reply }: { reply: AssistantAnswer }) {
  const { result, source } = reply
  const ai = source.model ?? 'AI'
  const by =
    source.interpret === 'ai' && source.format === 'ai'
      ? `Interpreted and written by ${ai}`
      : source.interpret === 'ai'
        ? `Interpreted by ${ai} · answer from a template`
        : 'Keyword match · answer from a template (AI not available)'
  return (
    <div className="flex max-w-[95%] flex-col gap-2 self-start">
      <div className="rounded-card rounded-bl-[6px] bg-page px-4 py-3">
        <AnswerText text={reply.answer} />
      </div>
      <p className="flex items-center gap-1.5 px-1 text-caption text-ink-muted">
        <Sparkles className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        {by}
      </p>
      {result && <DataView result={result} />}
    </div>
  )
}

/** Plain text with "- " lines shown as a list. No HTML or markdown is rendered. */
function AnswerText({ text }: { text: string }) {
  const blocks: { type: 'p' | 'ul'; lines: string[] }[] = []
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const isItem = /^[-•*]\s+/.test(line)
    const clean = line.replace(/^[-•*]\s+/, '')
    const last = blocks.at(-1)
    if (isItem && last?.type === 'ul') last.lines.push(clean)
    else blocks.push({ type: isItem ? 'ul' : 'p', lines: [clean] })
  }
  return (
    <div className="flex flex-col gap-2 text-body-sm text-ink">
      {blocks.map((b, i) =>
        b.type === 'p' ? (
          <p key={i}>{b.lines[0]}</p>
        ) : (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
            {b.lines.map((l, j) => (
              <li key={j}>{l}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}

function cell(col: Column, v: Cell) {
  if (v == null || v === '') return <span className="text-ink-muted">–</span>
  switch (col.type) {
    case 'money':
      return formatMoney(Number(v))
    case 'datetime':
      return formatDateTime(String(v))
    case 'status':
      return (ORDER_STATUSES as readonly string[]).includes(String(v)) ? <StatusBadge status={v as OrderStatus} /> : String(v)
    default:
      return String(v)
  }
}

/** The structured result behind the answer, so it can be checked. */
function DataView({ result }: { result: QueryResult }) {
  const params = Object.entries(result.params).filter(([, v]) => v != null)
  return (
    <details className="group rounded-card border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-body-sm text-ink hover:text-accent-text">
        <Database className="size-4 text-ink-muted" strokeWidth={1.8} aria-hidden="true" />
        Show the data
        <span className="text-caption text-ink-muted">
          · {result.rows.length} {result.rows.length === 1 ? 'row' : 'rows'}
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
        <div>
          <p className="text-body-sm font-medium text-ink">{result.title}</p>
          <p className="mt-0.5 font-mono text-caption text-ink-muted">
            {result.query}({params.map(([k, v]) => `${k}: ${v}`).join(', ')})
          </p>
        </div>
        {result.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-caption">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  {result.columns.map((c) => (
                    <th key={c.key} scope="col" className={clsx('py-2 pr-4 font-normal whitespace-nowrap', (c.type === 'money' || c.type === 'number') && 'text-right')}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {result.columns.map((c) => (
                      <td key={c.key} className={clsx('py-2 pr-4 align-top text-ink', (c.type === 'money' || c.type === 'number') && 'text-right whitespace-nowrap tabular-nums')}>
                        {cell(c, r[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.truncated && <p className="mt-2 text-caption text-ink-muted">Showing the first {result.rows.length} rows.</p>}
          </div>
        ) : (
          <p className="text-caption text-ink-muted">No rows matched.</p>
        )}
      </div>
    </details>
  )
}
