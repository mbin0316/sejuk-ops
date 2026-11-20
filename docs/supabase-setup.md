# Supabase setup

About 5 minutes (free plan).

## 1. Create the project

[supabase.com](https://supabase.com) → **New project**. Any name (e.g. `sejuk-ops`), a strong database password (you won't need it again), region **Southeast Asia (Singapore)**.

## 2. Create the tables and demo data

**SQL Editor → New query**, then run these two files in order (paste the whole file, click **Run**):

1. [`supabase/schema.sql`](../supabase/schema.sql): tables, audit trail, the private `job-files` storage bucket, and the lock-down (RLS on, no policies).
2. [`supabase/seed.sql`](../supabase/seed.sql): the four technicians and 26 demo orders spread over the last three weeks.

The demo dates are relative to the day you run it. To refresh them later (this **deletes all orders**):

```sql
select seed_demo_data();
```

## 3. Server environment variables

**Project Settings → API Keys** (or **Data API**). Add to `.env.local` (and later to Vercel):

```env
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-or-service-role-key
```

Use the **secret** key (`sb_secret_…`) or the legacy **service_role** key. Both work. Never use it in the browser: only the API reads it, and nothing in `src/` can import it.

Restart `npm run dev` after editing `.env.local`.

## Why the browser never talks to Supabase

Every table has RLS enabled with no policies, so the public anon key can't read or write anything. All access goes through `/api`, which verifies the Auth0 token, checks the role and the workflow rules (for example, only the admin assigns; a technician sees only their own jobs), and writes the audit trail.
