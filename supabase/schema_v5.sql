-- Finance App schema v5 — budget emoji + purchase types
-- Run in Supabase SQL Editor AFTER schema_v4.sql.

alter table budgets
  add column if not exists emoji text;

-- Optional per-budget list of purchase types, each with a persistent colour.
create table if not exists purchase_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid not null references budgets(id) on delete cascade,
  name text not null,
  color text not null, -- hex colour, e.g. #34d399
  created_at timestamptz not null default now(),
  unique (budget_id, name)
);

create index if not exists idx_purchase_types_budget on purchase_types(budget_id);
create index if not exists idx_purchase_types_user on purchase_types(user_id);

alter table purchase_types enable row level security;

create policy "Users manage their own purchase types"
  on purchase_types for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
