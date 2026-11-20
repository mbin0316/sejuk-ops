-- Sejuk Ops database schema.
-- Run once in Supabase → SQL Editor (paste the whole file, Run). Safe to re-run: it only creates what's missing.
--
-- Access model: the browser never talks to Supabase. Every read/write goes through the /api
-- function using the service-role key, which enforces roles and workflow rules.
-- RLS is enabled on every table with NO policies, so the public anon key can read or write nothing.

-- ---------------------------------------------------------------------------
-- Technicians (mock list from the assessment brief: Ali, John, Bala, Yusoff)
-- ---------------------------------------------------------------------------
create table if not exists technicians (
  id         smallint generated always as identity primary key,
  name       text not null unique,
  -- Digits only, country code first (e.g. 60123456789). Used for wa.me links.
  phone      text not null check (phone ~ '^[0-9]{8,15}$'),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders. Status workflow: new → assigned → in_progress → job_done → reviewed → closed
-- ---------------------------------------------------------------------------
create sequence if not exists order_no_seq;

-- ORDER0001, ORDER0002 … (widens past ORDER9999 instead of truncating)
create or replace function next_order_no() returns text
language sql volatile set search_path = public as $$
  select 'ORDER' || lpad(n::text, greatest(4, length(n::text)), '0')
  from (select nextval('order_no_seq') as n) s
$$;

create table if not exists orders (
  id                  uuid primary key default gen_random_uuid(),
  order_no            text not null unique default next_order_no(),
  customer_name       text not null check (length(btrim(customer_name)) between 1 and 120),
  customer_phone      text not null check (length(btrim(customer_phone)) between 6 and 20),
  -- Digits only, so search finds "012-345 6789" when someone types "0123456789".
  customer_phone_digits text generated always as (regexp_replace(customer_phone, '\D', '', 'g')) stored,
  customer_address    text not null check (length(btrim(customer_address)) between 1 and 300),
  problem_description text not null check (length(btrim(problem_description)) between 1 and 1000),
  service_type        text not null check (service_type in
                        ('Installation', 'General servicing', 'Chemical wash', 'Repair', 'Gas top-up', 'Inspection')),
  quoted_price        numeric(10,2) not null check (quoted_price >= 0),
  technician_id       smallint references technicians(id),
  admin_notes         text check (admin_notes is null or length(admin_notes) <= 1000),
  status              text not null default 'new' check (status in
                        ('new', 'assigned', 'in_progress', 'job_done', 'reviewed', 'closed')),
  -- Times the technician postponed / rescheduled the visit (KPI dashboard).
  reschedule_count    integer not null default 0 check (reschedule_count >= 0),
  created_at          timestamptz not null default now(),
  created_by          text not null,
  assigned_at         timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  reviewed_at         timestamptz,
  reviewed_by         text,
  closed_at           timestamptz,
  updated_at          timestamptz not null default now(),
  -- Anything past "new" must have a technician.
  constraint orders_assigned_has_technician check (status = 'new' or technician_id is not null)
);

alter sequence order_no_seq owned by orders.order_no;

create index if not exists orders_status_idx       on orders (status);
create index if not exists orders_technician_idx   on orders (technician_id);
create index if not exists orders_created_at_idx   on orders (created_at desc);
create index if not exists orders_completed_at_idx on orders (completed_at);

create or replace function touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists orders_touch_updated_at on orders;
create trigger orders_touch_updated_at before update on orders
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Service completion report (Technician portal, Module 2). One per order.
-- final_amount = quoted_price + extra_charges, computed by the API.
-- ---------------------------------------------------------------------------
create table if not exists job_reports (
  order_id        uuid primary key references orders(id) on delete cascade,
  technician_id   smallint not null references technicians(id),
  technician_name text not null,
  work_done       text not null check (length(btrim(work_done)) between 1 and 2000),
  extra_charges   numeric(10,2) not null default 0 check (extra_charges >= 0),
  final_amount    numeric(10,2) not null check (final_amount >= 0),
  remarks         text check (remarks is null or length(remarks) <= 1000),
  -- Optional payment collected on site
  payment_amount  numeric(10,2) check (payment_amount is null or payment_amount >= 0),
  payment_method  text check (payment_method is null or payment_method in ('cash', 'card', 'bank_transfer', 'ewallet')),
  completed_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Uploaded files (job photos / video / PDF, payment receipt). Files live in the
-- private "job-files" Storage bucket; this table is the index.
-- ---------------------------------------------------------------------------
create table if not exists attachments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  kind         text not null check (kind in ('job', 'receipt')),
  storage_path text not null unique,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   integer not null check (size_bytes > 0),
  uploaded_by  text not null,
  created_at   timestamptz not null default now()
);

create index if not exists attachments_order_idx on attachments (order_id);

-- ---------------------------------------------------------------------------
-- Audit trail: every key action on an order (who, what, when).
-- ---------------------------------------------------------------------------
create table if not exists order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references orders(id) on delete cascade,
  -- created | assigned | reassigned | started | rescheduled | completed | reviewed | closed
  action      text not null,
  from_status text,
  to_status   text,
  actor_sub   text not null,
  actor_name  text not null,
  actor_role  text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists order_events_order_idx on order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Lock down: RLS on, no policies. Only the service role (used by /api) gets through.
-- ---------------------------------------------------------------------------
alter table technicians  enable row level security;
alter table orders       enable row level security;
alter table job_reports  enable row level security;
alter table attachments  enable row level security;
alter table order_events enable row level security;

-- Supabase grants new functions to anon/authenticated by default; take that back.
revoke execute on function next_order_no()    from public, anon, authenticated;
revoke execute on function touch_updated_at() from public, anon, authenticated;

-- Newer Supabase projects no longer grant table access to the API roles automatically,
-- so grant the server's role (service_role, used only by /api) exactly what it needs.
-- anon and authenticated get nothing.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function next_order_no() to service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket for uploads (private; the API hands out short-lived signed URLs).
-- 20 MB per file; photos, video and PDF only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-files', 'job-files', false, 20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'application/pdf']
)
on conflict (id) do nothing;
