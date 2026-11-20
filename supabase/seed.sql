-- Sejuk Ops demo data. Run after schema.sql (Supabase → SQL Editor).
--
-- Creates the four technicians and a function that (re)builds ~26 demo orders spread over the
-- last three weeks, *relative to today*, so the KPI dashboard and AI questions such as
-- "jobs completed today / this week / last week" always have data.
--
--   select seed_demo_data();   -- wipes ALL orders, reports, files index and audit events, then reseeds
--
-- Technician phone numbers are placeholders for the wa.me links. Put real test numbers in
-- (digits only, country code first) if you want the WhatsApp links to reach a phone:
--   update technicians set phone = '60123456789' where name = 'Ali';

insert into technicians (name, phone) values
  ('Ali',    '60100000001'),
  ('John',   '60100000002'),
  ('Bala',   '60100000003'),
  ('Yusoff', '60100000004')
on conflict (name) do nothing;

create or replace function seed_demo_data() returns void
language plpgsql set search_path = public as $$
declare
  -- Midnight today in Malaysia time (local timestamp, no zone).
  today_kl timestamp := date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur');
begin
  truncate order_events, attachments, job_reports, orders restart identity;

  drop table if exists pg_temp.seed_src;
  create temp table seed_src (
    n int, customer_name text, customer_phone text, customer_address text, problem_description text,
    service_type text, quoted_price numeric, technician text, status text,
    created_day int, created_hour numeric, done_day int, done_hour numeric,
    extra_charges numeric, work_done text, payment_method text, reschedule_count int
  ) on commit drop;

  insert into seed_src values
    -- Older (2–3 weeks ago): closed
    ( 1, 'Tan Wei Ming',          '012-345 6701', '12, Jalan SS 2/24, 47300 Petaling Jaya, Selangor',               'Unit not cold, blowing warm air',            'Repair',            180.00, 'Ali',    'closed',      -19,  9, -18, 15, 120.00, 'Replaced faulty compressor capacitor, cleaned filters and tested cooling', 'cash',          0),
    ( 2, 'Nurul Aina Hassan',     '013-288 4410', 'B-7-3, Residensi Bangsar, Jalan Maarof, 59100 Kuala Lumpur',     'Water leaking from indoor unit',             'General servicing', 120.00, 'John',   'closed',      -17, 10, -16, 11,   0.00, 'Cleared clogged drain pipe and serviced the unit',                         'bank_transfer', 0),
    ( 3, 'Rajesh Kumar',          '016-777 1203', '45, Jalan Kenari 5, Bandar Puchong Jaya, 47100 Puchong',         'Install 2 new 1.5HP units',                  'Installation',      900.00, 'Bala',   'closed',      -16,  9, -14, 16, 250.00, 'Installed two 1.5HP units, extra 6m copper piping',                       'bank_transfer', 1),
    ( 4, 'Lim Siew Ling',         '017-650 9921', '8, Jalan Setia Murni U13/52, 40170 Shah Alam',                   'Musty smell when unit runs',                 'Chemical wash',     220.00, 'Yusoff', 'closed',      -15, 11, -13, 10,   0.00, 'Chemical wash of coil and blower wheel',                                   'ewallet',       0),
    ( 5, 'Ahmad Faizal',          '019-334 5567', '22, Jalan Wangsa 3/1, Wangsa Maju, 53300 Kuala Lumpur',          'Annual service for 3 units',                 'General servicing', 300.00, 'Ali',    'closed',      -13,  9, -12, 14,   0.00, 'Serviced 3 units: filters, coils, drain lines',                            'cash',          0),
    -- Last week-ish: reviewed by manager
    ( 6, 'Chong Kar Wai',         '012-901 2234', 'A-12-5, Mont Kiara Palma, 50480 Kuala Lumpur',                   'Unit trips the breaker',                     'Repair',            150.00, 'Ali',    'reviewed',    -11, 10, -10, 15,  80.00, 'Replaced burnt contactor and checked wiring',                              'card',          0),
    ( 7, 'Siti Hajar',            '011-2345 6789','3, Jalan Damai 7, Taman Damai, 43000 Kajang',                    'Weak cooling, gas may be low',               'Gas top-up',        160.00, 'John',   'reviewed',    -10,  9,  -9, 11,   0.00, 'Topped up R32 gas and checked pressure',                                   'cash',          0),
    ( 8, 'Muthu Raman',           '014-556 7788', '17, Lorong Bunga Raya 2, 41200 Klang',                           'Install 1 unit in master bedroom',           'Installation',      650.00, 'Bala',   'reviewed',    -10, 14,  -8, 16,   0.00, 'Installed 1.0HP unit with bracket and drainage',                           'bank_transfer', 1),
    ( 9, 'Wong Mei Fong',         '016-223 1188', '9, Jalan USJ 9/5Q, 47620 Subang Jaya',                           'Outdoor unit very noisy',                    'Repair',            200.00, 'Ali',    'reviewed',     -9, 10,  -7, 12, 650.00, 'Replaced outdoor fan motor and mounting bracket',                          'card',          0),
    (10, 'Hafiz Rahman',          '018-777 3321', 'Lot 5, Jalan Bukit Jelutong, 40150 Shah Alam',                   'Service 2 units',                            'General servicing', 200.00, 'Yusoff', 'reviewed',     -8,  9,  -6, 15,   0.00, 'Serviced 2 units',                                                         'cash',          0),
    (11, 'Kamal Ariffin',         '013-400 1122', '6, Jalan Melati 3, Taman Melawati, 53100 Kuala Lumpur',          'Chemical wash for 2 units',                  'Chemical wash',     400.00, 'Ali',    'reviewed',     -8, 15,  -6, 10,   0.00, 'Chemical wash for 2 units',                                                'bank_transfer', 0),
    (12, 'Priya Nair',            '012-778 9900', '28, Jalan Bangsar Utama 1, 59000 Kuala Lumpur',                  'Unit will not turn on',                      'Inspection',         80.00, 'John',   'reviewed',     -7,  9,  -5, 11,  40.00, 'Found blown fuse on PCB, replaced and tested',                             'ewallet',       0),
    -- This week: job done, waiting for manager review
    (13, 'Goh Boon Huat',         '012-311 4455', '15, Jalan PJU 1/41, Dataran Prima, 47301 Petaling Jaya',         'Water dripping down the wall',               'General servicing', 120.00, 'Ali',    'job_done',     -4,  9,  -3, 11,   0.00, 'Cleared drain pan and re-levelled indoor unit',                            'cash',          0),
    (14, 'Fatimah Zahra',         '017-882 3344', '2-3, Pangsapuri Seri Mawar, 43300 Seri Kembangan',               'Unit beeps, remote not responding',          'Repair',            150.00, 'Ali',    'job_done',     -3, 10,  -2, 14,  90.00, 'Replaced IR receiver board',                                               'card',          0),
    (15, 'Daniel Yap',            '016-909 1212', '31, Jalan Puteri 2/4, Bandar Puteri, 47100 Puchong',             'Install unit in living room',                'Installation',      750.00, 'Bala',   'job_done',     -4, 14,  -1, 16, 120.00, 'Installed 2.0HP unit, extra trunking',                                     'bank_transfer', 1),
    (16, 'Aisyah Kamarul',        '019-210 6655', '11, Jalan Ampang Hilir, 55000 Kuala Lumpur',                     'Unit cooling slowly',                        'Gas top-up',        160.00, 'John',   'job_done',     -2,  9,  -1, 11,   0.00, 'Gas top-up and coil clean',                                                'cash',          0),
    (17, 'Lee Chee Keong',        '012-655 0909', '7, Jalan SS 15/4, 47500 Subang Jaya',                            'Service 1 unit',                             'General servicing', 100.00, 'Ali',    'job_done',     -1, 10,   0, 10,   0.00, 'Serviced 1 unit',                                                          'ewallet',       0),
    (18, 'Nor Azman',             '013-922 7788', '19, Jalan Kenanga 4, Taman Kenanga, 43200 Cheras',               'Ice forming on indoor coil',                 'Repair',            180.00, 'Yusoff', 'job_done',     -1,  9,   0,  9,  60.00, 'Replaced thermistor sensor, defrosted coil',                               'cash',          0),
    -- In progress
    (19, 'Vincent Tan',           '012-300 4567', '5, Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur',            'Chemical wash 1 unit',                       'Chemical wash',     220.00, 'John',   'in_progress',  -1, 14, null, null, null, null, null, 0),
    (20, 'Zulkifli Omar',         '017-345 1290', '24, Jalan Kristal 7/1, Seksyen 7, 40000 Shah Alam',              'Install 2 units in new house',               'Installation',     1400.00, 'Bala',   'in_progress',  -2, 11, null, null, null, null, null, 0),
    -- Assigned, not started (Bala is heavily loaded on purpose, for the "overloaded" insight)
    (21, 'Kavitha Subramaniam',   '016-512 3434', '10, Jalan Mutiara 2, Taman Mutiara, 56000 Cheras',               'Indoor unit leaking water',                  'General servicing', 120.00, 'Bala',   'assigned',     -1, 16, null, null, null, null, null, 1),
    (22, 'Eric Ng',               '012-818 2020', '3A, Jalan SS 21/37, Damansara Utama, 47400 Petaling Jaya',       'Weak airflow from unit',                     'Inspection',         80.00, 'Bala',   'assigned',      0,  9, null, null, null, null, null, 0),
    (23, 'Hasnah Ibrahim',        '019-655 4321', '14, Jalan Sri Hartamas 8, 50480 Kuala Lumpur',                   'Annual service for 4 units',                 'General servicing', 400.00, 'Bala',   'assigned',      0, 10, null, null, null, null, null, 2),
    (24, 'Ong Kah Seng',          '013-701 8899', '2, Jalan Bukit Bintang, 55100 Kuala Lumpur',                     'Not cold enough, possible gas leak',         'Gas top-up',        160.00, 'Yusoff', 'assigned',     -1, 11, null, null, null, null, null, 1),
    -- New, not assigned yet
    (25, 'Melissa Teoh',          '012-998 3311', '21, Jalan Dato Onn, 50480 Kuala Lumpur',                         'Install new unit in study room',             'Installation',      700.00, null,     'new',           0, 11, null, null, null, null, null, 0),
    (26, 'Shahril Nizam',         '011-1122 3344','8, Jalan Gombak 5, Setapak, 53000 Kuala Lumpur',                 'Unit makes a clicking noise',                'Repair',            150.00, null,     'new',           0, 12, null, null, null, null, null, 0);

  with timed as (
    select s.*,
      t.id as technician_id,
      -- Never in the future: today's later slots are pulled back to just before now.
      least((today_kl + s.created_day * interval '1 day' + s.created_hour * interval '1 hour') at time zone 'Asia/Kuala_Lumpur',
            now() - (40 - s.n) * interval '3 minutes') as created_at,
      case when s.done_day is not null then
        least((today_kl + s.done_day * interval '1 day' + s.done_hour * interval '1 hour') at time zone 'Asia/Kuala_Lumpur',
              now() - (40 - s.n) * interval '1 minute')
      end as completed_at
    from seed_src s
    left join technicians t on t.name = s.technician
  )
  insert into orders (customer_name, customer_phone, customer_address, problem_description, service_type, quoted_price,
                      technician_id, status, reschedule_count, created_at, created_by,
                      assigned_at, started_at, completed_at, reviewed_at, reviewed_by, closed_at, admin_notes)
  select customer_name, customer_phone, customer_address, problem_description, service_type, quoted_price,
         technician_id, status, reschedule_count, created_at, 'Admin',
         case when status <> 'new' then created_at + interval '20 minutes' end,
         case
           when completed_at is not null then completed_at - interval '90 minutes'
           when status = 'in_progress' then least(created_at + interval '18 hours', now() - interval '25 minutes')
         end,
         completed_at,
         case when status in ('reviewed', 'closed') then least(completed_at + interval '1 day', now() - interval '10 minutes') end,
         case when status in ('reviewed', 'closed') then 'Manager' end,
         case when status = 'closed' then least(completed_at + interval '2 days', now() - interval '5 minutes') end,
         case when n in (3, 20) then 'Customer prefers morning slots. Call before arriving.' end
  from timed
  order by created_at, n;

  -- Service completion reports for finished jobs. final = quoted + extra.
  insert into job_reports (order_id, technician_id, technician_name, work_done, extra_charges, final_amount,
                           remarks, payment_amount, payment_method, completed_at)
  select o.id, o.technician_id, t.name, s.work_done, s.extra_charges, o.quoted_price + s.extra_charges,
         case when s.extra_charges > 0 then 'Extra parts and labour explained to customer before work.' end,
         o.quoted_price + s.extra_charges, s.payment_method, o.completed_at
  from seed_src s
  join orders o on o.customer_name = s.customer_name
  join technicians t on t.id = o.technician_id
  where o.status in ('job_done', 'reviewed', 'closed');

  -- Audit trail rebuilt from the timestamps above.
  insert into order_events (order_id, action, from_status, to_status, actor_sub, actor_name, actor_role, details, created_at)
  select o.id, e.action, e.from_status, e.to_status, 'seed', e.actor_name, e.actor_role, e.details, e.at
  from orders o
  left join technicians t on t.id = o.technician_id
  cross join lateral (values
    ('created',   null,          'new',         'Admin',  'admin',      jsonb_build_object('orderNo', o.order_no), o.created_at),
    ('assigned',  'new',         'assigned',    'Admin',  'admin',      jsonb_build_object('technician', t.name),  o.assigned_at),
    ('started',   'assigned',    'in_progress', t.name,   'technician', '{}'::jsonb,                               o.started_at),
    ('completed', 'in_progress', 'job_done',    t.name,   'technician', '{}'::jsonb,                               o.completed_at),
    ('reviewed',  'job_done',    'reviewed',    'Manager','manager',    '{}'::jsonb,                               o.reviewed_at),
    ('closed',    'reviewed',    'closed',      'Manager','manager',    '{}'::jsonb,                               o.closed_at)
  ) as e(action, from_status, to_status, actor_name, actor_role, details, at)
  where e.at is not null;

  -- Postponed visits (reschedule_count), spread evenly between assignment and the start of work
  -- (or now), so the KPI dashboard can count reschedules per technician per day.
  insert into order_events (order_id, action, from_status, to_status, actor_sub, actor_name, actor_role, details, created_at)
  select o.id, 'rescheduled', 'assigned', 'assigned', 'seed', t.name, 'technician',
         jsonb_build_object('technician', t.name, 'technicianId', t.id, 'reason', 'Customer asked for another day'),
         o.assigned_at + (coalesce(o.started_at, now()) - o.assigned_at) * k / (o.reschedule_count + 1)
  from orders o
  join technicians t on t.id = o.technician_id
  cross join lateral generate_series(1, o.reschedule_count) as k
  where o.reschedule_count > 0 and o.assigned_at is not null;
end $$;

revoke execute on function seed_demo_data() from public, anon, authenticated;

select seed_demo_data();
