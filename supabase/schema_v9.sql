-- Finance App schema v9 — monthly archive snapshots
-- Run in Supabase SQL Editor AFTER schema_v8.sql.
-- Stores a read-only closing snapshot per user per month so a completed month
-- is archived without resetting the live (running) tables.

create table if not exists monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null, -- first day of the archived (completed) month
  accounts jsonb not null default '[]',
  income jsonb not null default '[]',
  payments jsonb not null default '[]',
  budgets jsonb not null default '[]',
  totals jsonb not null default '{}', -- { netWorth, revenue, spend, cashFlow, netWorthChange }
  created_at timestamptz not null default now(),
  unique (user_id, month)
);

create index if not exists idx_monthly_snapshots_user on monthly_snapshots(user_id);

alter table monthly_snapshots enable row level security;

create policy "Users manage their own snapshots"
  on monthly_snapshots for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
