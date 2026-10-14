-- The surveyor now picks the survey result (gap type) in the in-app form.
-- A report that carries a result writes it straight to the property's
-- survey_result_detail, so the office no longer re-types it. The trigger runs
-- as its owner because the surveyor role can't update businesses (RLS) — it
-- only ever touches that one column of the reported property.

alter table public.survey_reports
  add column if not exists survey_result text
  check (survey_result in ('נמצא פער בסיווג', 'נמצא פער שטח + סיווג', 'נמצא פער שטח', 'לא נמצא עסק/פער שטח'));

create or replace function public.apply_survey_report_result() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.survey_result is not null then
    update public.businesses
       set survey_result_detail = new.survey_result
     where id = new.business_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.apply_survey_report_result() from public, anon, authenticated;

drop trigger if exists survey_reports_apply_result on public.survey_reports;
create trigger survey_reports_apply_result
  after insert on public.survey_reports
  for each row execute function public.apply_survey_report_result();
