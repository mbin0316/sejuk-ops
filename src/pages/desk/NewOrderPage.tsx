import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { createOrderSchema, whatsAppLink, type OrderDetail } from '../../../shared/orders.ts'
import { Field } from '../../components/form.tsx'
import { OrderFacts } from '../../components/OrderFacts.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import { buttonClass, describedBy, INPUT_CLASS, SELECT_CLASS, TEXTAREA_CLASS } from '../../components/styles.ts'
import { Button, ButtonLink, Card, HighlightCard, NavyPanel, StatusBadge } from '../../components/ui.tsx'
import { ApiError } from '../../lib/api.ts'
import { SERVICE_TYPES } from '../../lib/domain.ts'
import { technicianJobMessage, useCreateOrder, useTechnicians } from '../../lib/orders.ts'

// Same rules as the API; only the technician select differs (a string in the form).
const formSchema = createOrderSchema.extend({
  technicianId: z.string(),
  adminNotes: z.string().trim().max(1000, 'Keep notes under 1,000 characters'),
})
type FormInput = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

const EMPTY: Partial<FormInput> = {
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  problemDescription: '',
  // Empty until chosen; the schema rejects it with "Choose a service type".
  serviceType: '' as FormInput['serviceType'],
  technicianId: '',
  adminNotes: '',
}

/** Admin portal: create a service order (Module 1). Shows an order summary after saving. */
export function NewOrderPage() {
  const [created, setCreated] = useState<OrderDetail | null>(null)
  const technicians = useTechnicians()
  const create = useCreateOrder()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(formSchema), defaultValues: EMPTY })

  const onSubmit = handleSubmit((values) => {
    create.mutate(
      { ...values, technicianId: values.technicianId ? Number(values.technicianId) : null, adminNotes: values.adminNotes || undefined },
      {
        onSuccess: (order) => {
          setCreated(order)
          window.scrollTo({ top: 0 })
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            for (const [field, message] of Object.entries(err.fields)) {
              if (field in EMPTY || field === 'quotedPrice') setError(field as keyof FormInput, { message })
            }
          }
        },
      },
    )
  })

  if (created) {
    return (
      <OrderCreated
        order={created}
        onAnother={() => {
          reset(EMPTY)
          create.reset()
          setCreated(null)
        }}
      />
    )
  }

  const err = (k: keyof FormInput) => errors[k]?.message

  return (
    <>
      <PageHeader
        title="New service order"
        actions={
          <ButtonLink to="/orders" variant="outline">
            <ArrowLeft className="size-5" strokeWidth={1.8} aria-hidden="true" />
            Job orders
          </ButtonLink>
        }
      />

      <div className="grid items-start gap-4 dash:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Card>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="mb-4 text-heading font-medium text-ink">Customer</legend>
              <Field id="customerName" label="Customer name" error={err('customerName')}>
                <input
                  id="customerName"
                  autoComplete="off"
                  className={INPUT_CLASS}
                  {...describedBy('customerName', err('customerName'))}
                  {...register('customerName')}
                />
              </Field>
              <Field id="customerPhone" label="Phone" hint="Used for the WhatsApp message when the job is done." error={err('customerPhone')}>
                <input
                  id="customerPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="012-345 6789"
                  className={INPUT_CLASS}
                  {...describedBy('customerPhone', err('customerPhone'), 'hint')}
                  {...register('customerPhone')}
                />
              </Field>
              <Field id="customerAddress" label="Service address" error={err('customerAddress')} className="md:col-span-2">
                <input
                  id="customerAddress"
                  autoComplete="off"
                  className={INPUT_CLASS}
                  {...describedBy('customerAddress', err('customerAddress'))}
                  {...register('customerAddress')}
                />
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="mb-4 text-heading font-medium text-ink">Job</legend>
              <Field id="serviceType" label="Service type" error={err('serviceType')}>
                <select
                  id="serviceType"
                  className={SELECT_CLASS}
                  {...describedBy('serviceType', err('serviceType'))}
                  {...register('serviceType')}
                >
                  <option value="" disabled>
                    Choose a service
                  </option>
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="quotedPrice" label="Quoted price" error={err('quotedPrice')}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body-sm text-ink-muted">RM</span>
                  <input
                    id="quotedPrice"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    className={`${INPUT_CLASS} pl-11 tabular-nums`}
                    {...describedBy('quotedPrice', err('quotedPrice'))}
                    {...register('quotedPrice', { valueAsNumber: true })}
                  />
                </div>
              </Field>
              <Field id="problemDescription" label="Problem description" error={err('problemDescription')} className="md:col-span-2">
                <textarea
                  id="problemDescription"
                  rows={4}
                  placeholder="What the customer reported, e.g. unit not cold, water leaking"
                  className={TEXTAREA_CLASS}
                  {...describedBy('problemDescription', err('problemDescription'))}
                  {...register('problemDescription')}
                />
              </Field>
            </fieldset>

            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="mb-4 text-heading font-medium text-ink">Assignment</legend>
              <Field
                id="technicianId"
                label="Assigned technician"
                hint="You can also assign later from the order page."
                error={err('technicianId')}
              >
                <select id="technicianId" className={SELECT_CLASS} {...describedBy('technicianId', err('technicianId'), 'hint')} {...register('technicianId')}>
                  <option value="">Assign later</option>
                  {technicians.data
                    ?.filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field id="adminNotes" label="Admin notes" optional error={err('adminNotes')} className="md:col-span-2">
                <textarea
                  id="adminNotes"
                  rows={3}
                  placeholder="Access instructions, preferred time, parts to bring…"
                  className={TEXTAREA_CLASS}
                  {...describedBy('adminNotes', err('adminNotes'))}
                  {...register('adminNotes')}
                />
              </Field>
            </fieldset>

            {create.isError && !(create.error instanceof ApiError && Object.keys(create.error.fields).length) && (
              <p role="alert" className="rounded-input bg-danger-tint px-3 py-2 text-body-sm text-danger-text">
                Couldn't create the order: {create.error.message}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <ButtonLink to="/orders" variant="outline">
                Cancel
              </ButtonLink>
              <Button type="submit" disabled={create.isPending}>
                <Plus className="size-5" strokeWidth={1.8} aria-hidden="true" />
                {create.isPending ? 'Creating…' : 'Create order'}
              </Button>
            </div>
          </form>
        </Card>

        <NavyPanel className="flex flex-col gap-5">
          <div>
            <p className="text-label text-on-navy-muted">Order no.</p>
            <p className="mt-1 text-title font-medium">Auto-generated</p>
            <p className="mt-1 text-body-sm text-on-navy-soft">The next number in the ORDER0001 series is given when you save.</p>
          </div>
          <div className="border-t border-navy-800 pt-5">
            <p className="text-label text-on-navy-muted">Starting status</p>
            <p className="mt-1 text-body-sm text-on-navy-soft">
              <span className="text-on-navy">New</span> if no technician is chosen,{' '}
              <span className="text-on-navy">Assigned</span> if you pick one now.
            </p>
          </div>
        </NavyPanel>
      </div>
    </>
  )
}

/** Order summary shown after a successful submit (assessment bonus), with the technician WhatsApp link. */
function OrderCreated({ order, onAnother }: { order: OrderDetail; onAnother: () => void }) {
  const tech = order.technician
  return (
    <>
      <PageHeader title="Order created" />
      <div className="grid items-start gap-4 dash:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-heading font-medium text-ink">Order summary</h2>
            <StatusBadge status={order.status} />
          </div>
          <OrderFacts order={order} />
          <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-5">
            <ButtonLink to={`/orders/${order.id}`} variant="outline">
              View order
            </ButtonLink>
            <Button variant="dark" onClick={onAnother}>
              <Plus className="size-5" strokeWidth={1.8} aria-hidden="true" />
              Create another order
            </Button>
          </div>
        </Card>

        <HighlightCard className="flex flex-col gap-4" aria-live="polite">
          <div>
            <p className="text-label text-white/80">Saved</p>
            <p className="mt-1 text-title font-medium">{order.orderNo}</p>
            <p className="mt-1 text-body-sm text-white/90">
              {tech ? `Assigned to ${tech.name}. Send them the job details now.` : 'No technician yet. Assign one from the order page.'}
            </p>
          </div>
          {tech ? (
            <a
              href={whatsAppLink(tech.phone, technicianJobMessage(order))}
              target="_blank"
              rel="noreferrer"
              className={buttonClass('on-accent', 'md', 'w-full')}
            >
              <MessageCircle className="size-5" strokeWidth={1.8} aria-hidden="true" />
              WhatsApp {tech.name}
            </a>
          ) : (
            <ButtonLink to={`/orders/${order.id}`} variant="on-accent" className="w-full">
              Assign a technician
            </ButtonLink>
          )}
        </HighlightCard>
      </div>
    </>
  )
}
