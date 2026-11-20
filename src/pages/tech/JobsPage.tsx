import clsx from 'clsx'
import { ChevronRight, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import type { TechJob } from '../../../shared/jobs.ts'
import { CallButton, JobFacts, NavigateButton } from '../../components/JobBits.tsx'
import { buttonClass } from '../../components/styles.ts'
import { Button, Card, NavyPanel, StatusBadge } from '../../components/ui.tsx'
import { formatDateTime, formatDayKey, klDayKey } from '../../lib/format.ts'
import { useMyJobs, useStartJob } from '../../lib/jobs.ts'

/** Technician home (DESIGN.md §5 Technician: today's jobs): summary, next job, the rest, and recent completions. */
export function JobsPage() {
  const jobs = useMyJobs()

  if (jobs.isPending) {
    return (
      <div className="flex flex-col gap-3.5" aria-busy="true">
        <div className="h-[164px] animate-pulse rounded-panel bg-navy-900" />
        <div className="h-[300px] animate-pulse rounded-card bg-surface" />
        <p className="sr-only" role="status">
          Loading your jobs…
        </p>
      </div>
    )
  }
  if (jobs.isError) {
    return (
      <Card>
        <p role="alert" className="text-body-sm text-danger-text">
          {jobs.error.message}
        </p>
      </Card>
    )
  }

  const { active, done } = jobs.data
  const today = klDayKey()
  const doneToday = done.filter((j) => j.completedAt && klDayKey(j.completedAt) === today)
  // The job in progress comes first; otherwise the oldest assignment.
  const next = active.find((j) => j.status === 'in_progress') ?? active[0]
  const later = active.filter((j) => j !== next)

  return (
    <>
      <Summary doneCount={doneToday.length} openCount={active.length} />

      {next ? (
        <NextJob job={next} />
      ) : (
        <Card>
          <h2 className="text-heading-sm font-medium text-ink">No jobs waiting</h2>
          <p className="mt-1 text-body-sm text-ink-muted">New jobs from the admin show up here.</p>
        </Card>
      )}

      {later.length > 0 && (
        <section aria-labelledby="later-heading" className="flex flex-col gap-2.5">
          <h2 id="later-heading" className="px-1 pt-1.5 text-heading-sm font-medium text-ink">
            Up next
          </h2>
          {later.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section aria-labelledby="done-heading" className="flex flex-col gap-2.5">
          <h2 id="done-heading" className="flex items-baseline justify-between px-1 pt-1.5 text-heading-sm font-medium text-ink">
            Done this week
            <span className="text-label font-normal text-ink-muted">{done.length} done</span>
          </h2>
          {done.map((j) => (
            <JobRow key={j.id} job={j} />
          ))}
        </section>
      )}
    </>
  )
}

/** Navy summary card: "2 of 5 jobs done" with one pill per job (done, next, later). */
function Summary({ doneCount, openCount }: { doneCount: number; openCount: number }) {
  const total = doneCount + openCount
  return (
    <NavyPanel>
      <p className="text-body-sm text-on-navy-muted">Today, {formatDayKey(klDayKey())}</p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-hero font-medium tabular-nums">
          {doneCount} of {total}
        </span>
        <span className="text-body-sm text-on-navy-soft">jobs done</span>
      </p>
      {total > 0 && (
        <>
          <div className="mt-4 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={clsx(
                  'h-2.5 flex-1 rounded-full',
                  i < doneCount ? 'bg-success' : i === doneCount ? 'bg-accent' : 'bg-navy-800',
                )}
              />
            ))}
          </div>
          <ul className="mt-3 flex gap-4 text-caption text-on-navy-soft">
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              Done
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
              Next
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-on-navy-muted" aria-hidden="true" />
              Later
            </li>
          </ul>
        </>
      )}
    </NavyPanel>
  )
}

function NextJob({ job }: { job: TechJob }) {
  const start = useStartJob(job.id)
  const navigate = useNavigate()
  const inProgress = job.status === 'in_progress'

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-heading-sm font-medium text-ink">{inProgress ? 'Current job' : 'Next job'}</h2>
        <StatusBadge status={job.status} />
      </div>
      <div>
        <p className="text-body-sm text-ink-muted">
          {job.orderNo}
          {job.assignedAt && ` · assigned ${formatDateTime(job.assignedAt)}`}
        </p>
        <Link to={`/tech/jobs/${job.id}`} className="mt-1 block text-heading font-medium text-ink hover:text-accent-text">
          {job.customerName}
        </Link>
      </div>
      <JobFacts job={job} />

      {start.isError && (
        <p role="alert" className="text-caption text-danger-text">
          {start.error.message}
        </p>
      )}
      <div className="flex gap-2.5">
        <CallButton phone={job.customerPhone} name={job.customerName} />
        <NavigateButton address={job.customerAddress} className="flex-1 px-3" />
        {inProgress ? (
          <Link to={`/tech/jobs/${job.id}`} className={buttonClass('primary', 'lg', 'flex-[1.4] px-3')}>
            Complete job
          </Link>
        ) : (
          <Button
            size="lg"
            className="flex-[1.4] px-3"
            disabled={start.isPending}
            onClick={() => start.mutate(undefined, { onSuccess: () => navigate(`/tech/jobs/${job.id}`) })}
          >
            <Play className="size-5" strokeWidth={1.8} aria-hidden="true" />
            {start.isPending ? 'Starting…' : 'Start job'}
          </Button>
        )}
      </div>
    </Card>
  )
}

/** Whole row is a link to the job (DESIGN.md: Job row). */
function JobRow({ job }: { job: TechJob }) {
  return (
    <Link
      to={`/tech/jobs/${job.id}`}
      className="flex min-h-[64px] items-center gap-3 rounded-card bg-surface px-4 py-3 text-ink hover:text-ink hover:shadow-card"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-ink">
          {job.serviceType} · {job.customerName}
        </p>
        <p className="truncate text-caption text-ink-muted">
          {job.orderNo} · {job.customerAddress}
        </p>
      </div>
      <StatusBadge status={job.status} />
      <ChevronRight className="size-5 shrink-0 text-ink-muted" strokeWidth={1.8} aria-hidden="true" />
    </Link>
  )
}
