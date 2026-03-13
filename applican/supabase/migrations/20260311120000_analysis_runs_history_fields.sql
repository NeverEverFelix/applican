alter table public.analysis_runs
  add column if not exists company text not null default 'Unknown Company',
  add column if not exists location text not null default 'Unknown Location',
  add column if not exists experience_needed text not null default 'Not specified',
  add column if not exists job_type text not null default 'unknown',
  add column if not exists analysis_summary text not null default '';

alter table public.analysis_runs
  drop constraint if exists analysis_runs_job_type_valid;

alter table public.analysis_runs
  add constraint analysis_runs_job_type_valid
  check (job_type in ('remote', 'hybrid', 'onsite', 'unknown'));

update public.analysis_runs ar
set
  company = coalesce(nullif(trim(rr.output #>> '{job,company}'), ''), ar.company),
  location = coalesce(nullif(trim(rr.output #>> '{job,location}'), ''), ar.location),
  experience_needed = coalesce(nullif(trim(rr.output #>> '{job,experience_needed}'), ''), ar.experience_needed),
  job_type = case
    when lower(coalesce(rr.output #>> '{job,job_type}', '')) in ('remote', 'hybrid', 'onsite', 'unknown')
      then lower(rr.output #>> '{job,job_type}')
    else ar.job_type
  end,
  analysis_summary = coalesce(
    nullif(trim(rr.output #>> '{match,summary}'), ''),
    nullif(trim(rr.output #>> '{summary}'), ''),
    ar.analysis_summary
  )
from public.resume_runs rr
where rr.id = ar.run_id;
