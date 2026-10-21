-- Totals for the status line on the login screen, which runs before sign-in.
-- Every table stays closed to anonymous visitors; this function returns only
-- two counts (no names, addresses or rows), and runs with its owner's rights
-- so it can count past RLS.
create or replace function public.login_stats()
returns table (total bigint, high bigint)
language sql stable security definer set search_path = '' as $$
  select count(*), count(*) filter (where suspicion_rating = 'גבוה')
  from public.businesses
$$;
revoke execute on function public.login_stats() from public;
grant execute on function public.login_stats() to anon, authenticated;
