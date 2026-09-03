-- Finance App schema v2 — feature content model
-- Run in Supabase SQL Editor AFTER schema.sql (or on a fresh project; this drops the
-- generic Phase 1 tables and replaces them with the real feature tables).

-- Drop Phase 1 generic tables (order matters due to FKs)
drop table if exists budgets cascade;
drop table if exists transactions cascade;
drop table if exists categories cascade;
drop table if exists accounts cascade;

create extension if not exists pgcrypto;

-- ========== FLOW ACCOUNTS ==========
-- Places money flows: "Accounts Receivable" (money coming to you) and
-- "Accounts Payable" (money you owe / bills). An annual subscription payable
-- accrues annual_amount / 12 each month.
create table if not exists flow_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('receivable', 'payable')),
  amount numeric(14,2) not null default 0, -- current value/balance of this account
  is_annual_subscription boolean not null default false,
  annual_amount numeric(14,2), -- full yearly cost; accrues as annual_amount/12 per month when toggle on
  created_at timestamptz not null default now()
);

-- Monthly financial history for a flow account (entered at setup, editable later).
create table if not exists account_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references flow_accounts(id) on delete cascade,
  month date not null, -- stored as first day of month
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (account_id, month)
);

-- ========== INCOME ==========
create table if not exists income_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null default 0,
  is_recurring boolean not null default false, -- when true, amount auto-counts every month
  created_at timestamptz not null default now()
);

create table if not exists income_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  income_id uuid not null references income_items(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (income_id, month)
);

-- ========== SUBSCRIPTIONS ==========
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null default 0,
  is_recurring boolean not null default true, -- default on per spec
  created_at timestamptz not null default now()
);

create table if not exists subscription_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  month date not null,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (subscription_id, month)
);

-- ========== BUDGETS & EXPENSES ==========
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  monthly_limit numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- A logged purchase against a budget. Cost + budget are required;
-- date, purchase type, and purchase name are optional.
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_id uuid not null references budgets(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  name text,
  purchase_type text,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- ========== INDEXES ==========
create index if not exists idx_flow_accounts_user_id on flow_accounts(user_id);
create index if not exists idx_account_history_account on account_history(account_id);
create index if not exists idx_income_items_user_id on income_items(user_id);
create index if not exists idx_income_history_income on income_history(income_id);
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_subscription_history_sub on subscription_history(subscription_id);
create index if not exists idx_budgets_user_id on budgets(user_id);
create index if not exists idx_expenses_user_id on expenses(user_id);
create index if not exists idx_expenses_budget_id on expenses(budget_id);
create index if not exists idx_expenses_occurred_on on expenses(occurred_on);

-- ========== ROW LEVEL SECURITY ==========
alter table flow_accounts enable row level security;
alter table account_history enable row level security;
alter table income_items enable row level security;
alter table income_history enable row level security;
alter table subscriptions enable row level security;
alter table subscription_history enable row level security;
alter table budgets enable row level security;
alter table expenses enable row level security;

create policy "Users manage their own flow accounts"
  on flow_accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own account history"
  on account_history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own income items"
  on income_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own income history"
  on income_history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own subscriptions"
  on subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own subscription history"
  on subscription_history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own budgets"
  on budgets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own expenses"
  on expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
