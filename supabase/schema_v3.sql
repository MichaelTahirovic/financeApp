-- Finance App schema v3 — hidden accounts + custom ordering
-- Run in Supabase SQL Editor AFTER schema_v2.sql.

alter table flow_accounts
  add column if not exists hidden boolean not null default false,
  add column if not exists sort_order int;

-- Backfill sort_order per (user_id, kind) in creation order so existing
-- accounts keep their current display order and new ordering has a base.
with ranked as (
  select id,
         row_number() over (partition by user_id, kind order by created_at) as rn
  from flow_accounts
)
update flow_accounts fa
set sort_order = ranked.rn
from ranked
where fa.id = ranked.id and fa.sort_order is null;

create index if not exists idx_flow_accounts_sort on flow_accounts(user_id, kind, sort_order);
