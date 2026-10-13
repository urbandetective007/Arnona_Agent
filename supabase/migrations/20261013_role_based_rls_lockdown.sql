-- Lock the database to the app's 3 accounts, each with its own rights.
-- Before this, every policy only checked "is signed in", and public sign-up
-- is enabled — so anyone could create an account and read/change everything.
-- Now an account that isn't one of the 3 internal ones sees nothing.
-- (Service-role scripts/workflows bypass RLS and are unaffected.)

-- remove the single test report left from the survey-form rollout
delete from public.survey_reports where id = '5b35f011-7416-4586-9b62-e5161700a202' and surveyor_name = 'בדיקה';

-- role of the signed-in user, from the 3 internal accounts; null for anyone else
create or replace function public.app_role() returns text
language sql stable set search_path = '' as $$
  select case auth.jwt() ->> 'email'
    when 'employee@arnona-agent.internal' then 'employee'
    when 'manager@arnona-agent.internal'  then 'manager'
    when 'surveyor@arnona-agent.internal' then 'surveyor'
  end
$$;
revoke execute on function public.app_role() from public, anon;
grant execute on function public.app_role() to authenticated;

-- businesses, upload_sessions, business_types, business_type_aliases:
-- employee full, manager + surveyor read-only
do $$
declare t text;
begin
  foreach t in array array['businesses','upload_sessions','business_types','business_type_aliases'] loop
    execute format('drop policy if exists authenticated_full_access on public.%I', t);
    execute format('create policy employee_all on public.%I for all to authenticated using ((select public.app_role()) = ''employee'') with check ((select public.app_role()) = ''employee'')', t);
    execute format('create policy staff_read on public.%I for select to authenticated using ((select public.app_role()) in (''manager'',''surveyor''))', t);
  end loop;
end $$;

-- address_locations: employee full, manager read+insert+update (map pins), surveyor read
drop policy if exists authenticated_full_access on public.address_locations;
create policy employee_all on public.address_locations for all to authenticated
  using ((select public.app_role()) = 'employee') with check ((select public.app_role()) = 'employee');
create policy staff_read on public.address_locations for select to authenticated
  using ((select public.app_role()) in ('manager','surveyor'));
create policy manager_insert on public.address_locations for insert to authenticated
  with check ((select public.app_role()) = 'manager');
create policy manager_update on public.address_locations for update to authenticated
  using ((select public.app_role()) = 'manager') with check ((select public.app_role()) = 'manager');

-- survey_reports: employee full, manager read, surveyor read+insert+update
drop policy if exists authenticated_full_access on public.survey_reports;
create policy employee_all on public.survey_reports for all to authenticated
  using ((select public.app_role()) = 'employee') with check ((select public.app_role()) = 'employee');
create policy staff_read on public.survey_reports for select to authenticated
  using ((select public.app_role()) in ('manager','surveyor'));
create policy surveyor_insert on public.survey_reports for insert to authenticated
  with check ((select public.app_role()) = 'surveyor');
create policy surveyor_update on public.survey_reports for update to authenticated
  using ((select public.app_role()) = 'surveyor') with check ((select public.app_role()) = 'surveyor');

-- storage survey-files: all 3 read, employee+surveyor upload, employee delete
drop policy if exists survey_files_read on storage.objects;
drop policy if exists survey_files_insert on storage.objects;
drop policy if exists survey_files_delete on storage.objects;
create policy survey_files_read on storage.objects for select to authenticated
  using (bucket_id = 'survey-files' and (select public.app_role()) is not null);
create policy survey_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'survey-files' and (select public.app_role()) in ('employee','surveyor'));
create policy survey_files_update on storage.objects for update to authenticated
  using (bucket_id = 'survey-files' and (select public.app_role()) in ('employee','surveyor'))
  with check (bucket_id = 'survey-files' and (select public.app_role()) in ('employee','surveyor'));
create policy survey_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'survey-files' and (select public.app_role()) = 'employee');
