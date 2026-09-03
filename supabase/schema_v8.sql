-- Finance App schema v8 — keep purchases when a budget is deleted
-- Run in Supabase SQL Editor AFTER schema_v7.sql.
-- Changes expenses.budget_id to be nullable and to SET NULL on budget delete,
-- so purchases survive and become "Undefined".

alter table expenses alter column budget_id drop not null;

alter table expenses drop constraint if exists expenses_budget_id_fkey;
alter table expenses
  add constraint expenses_budget_id_fkey
  foreign key (budget_id) references budgets(id) on delete set null;
