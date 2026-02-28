-- Enforce resume run lifecycle states and idempotency keys.

update public.resume_runs
set request_id = id
where request_id is null;

update public.resume_runs
set status = 'queued'
where status is null or btrim(status) = '';

alter table if exists public.resume_runs
  alter column request_id set not null;

alter table if exists public.resume_runs
  alter column status set default 'queued';

alter table if exists public.resume_runs
  alter column status set not null;

alter table if exists public.resume_runs
  drop constraint if exists resume_runs_status_valid;

alter table if exists public.resume_runs
  add constraint resume_runs_status_valid
  check (status in ('queued', 'processing', 'success', 'failed'));

create unique index if not exists resume_runs_user_id_request_id_uidx
on public.resume_runs (user_id, request_id);
