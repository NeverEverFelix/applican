alter table public.resume_runs
  add column if not exists generation_queued_at timestamp with time zone;

create index if not exists resume_runs_generation_queued_at_idx
  on public.resume_runs (status, generation_queued_at, created_at, id);
