-- Finance App database schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query) after creating your project.
-- This sets up multi-tenant tables with Row-Level Security (RLS) so every user can only
-- ever see and modify their own data, even though everyone shares the same database.

-- Enable pgcrypto for gen_random_uuid() if not already enabled
create extension if not exists pgcrypto;

-- ========== ACCOUNTS ==========
-- e.g. "Checking", "Savings", "Credit Card"
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit_card', 'cash', 'investment', 'other')),
  starting_balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ========== CATEGORIES ==========
-- e.g. "Groceries", "Rent", "Salary"
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ========== TRANSACTIONS ==========
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  amount numeric(14,2) not null, -- positive = income, negative = expense
  description text,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- ========== BUDGETS ==========
-- Monthly budget cap per category
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  monthly_limit numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, category_id)
);

-- ========== INDEXES ==========
create index if not exists idx_accounts_user_id on accounts(user_id);
create index if not exists idx_categories_user_id on categories(user_id);
create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_transactions_account_id on transactions(account_id);
create index if not exists idx_budgets_user_id on budgets(user_id);

-- ========== ROW LEVEL SECURITY ==========
-- This is the core privacy boundary: each policy ensures a user can only
-- select/insert/update/delete rows where user_id matches their own auth id.

alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

create policy "Users can manage their own accounts"
  on accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own budgets"
  on budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
