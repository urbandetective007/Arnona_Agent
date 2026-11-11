-- 1) Room for up to 5 links per business (was 3). Optional — the agent fills
--    only links it actually verified, so most rows will leave these empty.
alter table public.businesses add column if not exists link4 text;
alter table public.businesses add column if not exists link5 text;

-- 2) Street → neighborhood corrections, editable by city employees.
--    The base mapping is the static data/street_neighborhoods.json; a row here
--    overrides the whole street (all house numbers) wherever the mapping is
--    used: manual entry, Excel upload and the agent's upload workflow.
--    street_key uses the same normalization as streetKey() in
--    src/lib/streetNeighborhoods.ts / street_key() in build_street_index.py.
create table if not exists public.street_neighborhood_overrides (
  street_key   text primary key,
  street_label text not null,
  neighborhood text not null,
  updated_at   timestamptz not null default now()
);

alter table public.street_neighborhood_overrides enable row level security;

-- Purely additive: no DROP / DELETE / UPDATE anywhere in this file — existing
-- tables, columns and rows are not touched.
create policy employee_all on public.street_neighborhood_overrides for all to authenticated
  using ((select public.app_role()) = 'employee') with check ((select public.app_role()) = 'employee');

create policy staff_read on public.street_neighborhood_overrides for select to authenticated
  using ((select public.app_role()) in ('manager','surveyor'));
