alter table public.analysis_runs
  add column if not exists industry text not null default 'Not specified';

update public.analysis_runs ar
set industry = coalesce(
  nullif(trim(rr.output #>> '{job,industry}'), ''),
  nullif(trim(rr.output #>> '{industry}'), ''),
  ar.industry
)
from public.resume_runs rr
where rr.id = ar.run_id;
