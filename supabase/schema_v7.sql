-- Finance App schema v7 — persist budget limit percentage
-- Run in Supabase SQL Editor AFTER schema_v6.sql.

alter table budgets
  add column if not exists limit_percent numeric(6,3);
