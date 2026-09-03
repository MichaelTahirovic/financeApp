# Finance Tracker

A private, cross-platform personal finance tracker. Works as an installable app on desktop
and mobile (PWA), backed by a free-tier Supabase Postgres database with Row-Level Security
so each signed-up user only ever sees their own data — no per-user database provisioning needed.

## Stack

- **Frontend:** Next.js (App Router) + Tailwind CSS, installable as a PWA
- **Auth + Database:** [Supabase](https://supabase.com) free tier (Postgres + Auth + Row-Level Security)
- **Hosting:** [Vercel](https://vercel.com) free tier

## One-time setup

### 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Create a new project (pick any name/region, generate a database password and save it somewhere safe).
3. Once the project is ready, go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` API key

### 2. Apply the database schema

1. In the Supabase dashboard, go to **SQL Editor → New query**.
2. Paste in the contents of [`supabase/schema.sql`](./supabase/schema.sql) and run it.
   This creates the `accounts`, `categories`, `transactions`, and `budgets` tables along with
   Row-Level Security policies so every user can only access their own rows.

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in the values from step 1:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to sign up / log in,
then land on the dashboard.

### 5. Deploy for free (accessible from anywhere)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com), sign up free, click **New Project**, and import the repo.
3. Add the same two environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   in the Vercel project settings.
4. Deploy. Vercel gives you a free `https://your-app.vercel.app` URL reachable from any device.
5. On mobile, open the URL in the browser and use "Add to Home Screen" (Safari/Chrome) to install
   it like a native app — this is enabled by the PWA `manifest.json` already included.

### 6. Inviting other users (non-technical, self-service)

Anyone can go to your deployed URL and click **Sign up** — they create their own account with
just an email + password, and Supabase's Row-Level Security guarantees they can only ever see
their own accounts/transactions/categories/budgets, even though everyone shares the same database.
No manual setup is required per user.

## Data model

- **accounts** — checking/savings/credit card/etc., each with a starting balance
- **categories** — income or expense categories (e.g. "Salary", "Groceries")
- **transactions** — individual income/expense entries tied to an account and optional category
- **budgets** — a monthly spending limit per category

See [`supabase/schema.sql`](./supabase/schema.sql) for full definitions and RLS policies.

## Notes

- Supabase free tier: 500MB database, 50k monthly active auth users — plenty of headroom to grow.
- Free-tier Supabase projects pause after ~1 week of no API activity; they auto-resume on the next request.
- Adding your first account/category currently requires inserting a row via the Supabase Table
  Editor (dashboard) — a UI for managing accounts/categories can be added as a follow-up.
