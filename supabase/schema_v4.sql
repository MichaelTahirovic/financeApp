-- Finance App schema v4 — hidden income items and subscriptions
-- Run in Supabase SQL Editor AFTER schema_v3.sql.

alter table income_items
  add column if not exists hidden boolean not null default false;

alter table subscriptions
  add column if not exists hidden boolean not null default false;
