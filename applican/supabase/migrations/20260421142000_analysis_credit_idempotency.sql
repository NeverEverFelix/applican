create table if not exists public.analysis_credit_consumptions (
  run_id uuid primary key references public.resume_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now()
);

create index if not exists analysis_credit_consumptions_user_created_at_idx
  on public.analysis_credit_consumptions (user_id, created_at desc);

alter table public.analysis_credit_consumptions enable row level security;

drop policy if exists "analysis_credit_consumptions_select_own" on public.analysis_credit_consumptions;
create policy "analysis_credit_consumptions_select_own"
  on public.analysis_credit_consumptions
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on table public.analysis_credit_consumptions to authenticated;
grant all on table public.analysis_credit_consumptions to service_role;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'consume_analysis_credit'
      and pg_get_function_identity_arguments(p.oid) = 'p_user_id uuid'
  ) then
    execute 'revoke all on function public.consume_analysis_credit(uuid) from public';
    execute 'drop function public.consume_analysis_credit(uuid)';
  end if;
end
$$;

create function public.consume_analysis_credit(p_user_id uuid, p_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  usage_row public.billing_usage%rowtype;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_run_id is null then
    raise exception 'p_run_id is required';
  end if;

  insert into public.billing_usage (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
  into usage_row
  from public.billing_usage
  where user_id = p_user_id
  for update;

  if exists (
    select 1
    from public.analysis_credit_consumptions acc
    where acc.run_id = p_run_id
      and acc.user_id = p_user_id
  ) then
    return jsonb_build_object(
      'allowed', true,
      'plan', usage_row.plan,
      'analyses_used', usage_row.analyses_used,
      'analyses_limit', usage_row.analyses_limit
    );
  end if;

  if usage_row.plan <> 'pro' and usage_row.analyses_limit is not null and usage_row.analyses_used >= usage_row.analyses_limit then
    return jsonb_build_object(
      'allowed', false,
      'plan', usage_row.plan,
      'analyses_used', usage_row.analyses_used,
      'analyses_limit', usage_row.analyses_limit
    );
  end if;

  update public.billing_usage
  set
    analyses_used = usage_row.analyses_used + 1,
    analyses_limit = case when usage_row.plan = 'pro' then null else usage_row.analyses_limit end,
    updated_at = now()
  where user_id = p_user_id
  returning * into usage_row;

  insert into public.analysis_credit_consumptions (run_id, user_id)
  values (p_run_id, p_user_id);

  return jsonb_build_object(
    'allowed', true,
    'plan', usage_row.plan,
    'analyses_used', usage_row.analyses_used,
    'analyses_limit', usage_row.analyses_limit
  );
end;
$$;

revoke all on function public.consume_analysis_credit(uuid, uuid) from public;
grant execute on function public.consume_analysis_credit(uuid, uuid) to service_role;
