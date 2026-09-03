-- Finance App schema v6 — purchase time
-- Run in Supabase SQL Editor AFTER schema_v5.sql.

alter table expenses
  add column if not exists occurred_time time;
