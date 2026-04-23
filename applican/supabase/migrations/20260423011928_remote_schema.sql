alter table "public"."resume_runs" drop constraint "resume_runs_status_check";


  create table "public"."extract_worker_heartbeats" (
    "worker_id" text not null,
    "hostname" text not null,
    "pid" integer not null,
    "role" text not null default 'extractor'::text,
    "started_at" timestamp with time zone not null default now(),
    "last_seen_at" timestamp with time zone not null default now()
      );


alter table "public"."extract_worker_heartbeats" enable row level security;

alter table "public"."resume_runs" add column "extraction_attempt_count" integer not null default 0;

alter table "public"."resume_runs" add column "extraction_claimed_at" timestamp with time zone;

alter table "public"."resume_runs" add column "extraction_claimed_by" text;

alter table "public"."resume_runs" add column "extraction_heartbeat_at" timestamp with time zone;

alter table "public"."resume_runs" add column "extraction_next_retry_at" timestamp with time zone;

CREATE INDEX extract_worker_heartbeats_last_seen_idx ON public.extract_worker_heartbeats USING btree (last_seen_at DESC);

CREATE UNIQUE INDEX extract_worker_heartbeats_pkey ON public.extract_worker_heartbeats USING btree (worker_id);

CREATE INDEX resume_runs_status_claimed_by_idx ON public.resume_runs USING btree (status, extraction_claimed_by);

CREATE INDEX resume_runs_status_heartbeat_idx ON public.resume_runs USING btree (status, extraction_heartbeat_at);

CREATE INDEX resume_runs_status_next_retry_idx ON public.resume_runs USING btree (status, extraction_next_retry_at, created_at, id);

alter table "public"."extract_worker_heartbeats" add constraint "extract_worker_heartbeats_pkey" PRIMARY KEY using index "extract_worker_heartbeats_pkey";

alter table "public"."resume_runs" add constraint "resume_runs_status_valid" CHECK ((status = ANY (ARRAY['queued'::text, 'extracting'::text, 'extracted'::text, 'failed'::text]))) not valid;

alter table "public"."resume_runs" validate constraint "resume_runs_status_valid";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.claim_next_resume_run(p_claimed_by text)
 RETURNS SETOF public.resume_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with next_run as (
    select rr.id
    from public.resume_runs rr
    where rr.status = 'queued'
    order by rr.created_at asc, rr.id asc
    for update skip locked
    limit 1
  )
  update public.resume_runs rr
  set
    status = 'extracting',
    error_code = null,
    error_message = null,
    extraction_claimed_by = p_claimed_by
  from next_run
  where rr.id = next_run.id
  returning rr.*;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_next_resume_run(p_claimed_by text, p_lease_seconds integer DEFAULT 120)
 RETURNS SETOF public.resume_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with next_run as (
    select rr.id
    from public.resume_runs rr
    where (
      rr.status = 'queued'
      and coalesce(rr.extraction_next_retry_at, rr.created_at) <= now()
    ) or (
      rr.status = 'extracting'
      and coalesce(rr.extraction_heartbeat_at, rr.extraction_claimed_at, rr.updated_at, rr.created_at)
        <= now() - make_interval(secs => greatest(p_lease_seconds, 1))
    )
    order by coalesce(rr.extraction_next_retry_at, rr.created_at) asc, rr.created_at asc, rr.id asc
    for update skip locked
    limit 1
  )
  update public.resume_runs rr
  set
    status = 'extracting',
    error_code = null,
    error_message = null,
    extraction_claimed_by = p_claimed_by,
    extraction_claimed_at = now(),
    extraction_heartbeat_at = now(),
    extraction_attempt_count = coalesce(rr.extraction_attempt_count, 0) + 1,
    extraction_next_retry_at = null
  from next_run
  where rr.id = next_run.id
  returning rr.*;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_resume_run(p_run_id uuid, p_claimed_by text)
 RETURNS SETOF public.resume_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  update public.resume_runs rr
  set
    status = 'extracting',
    error_code = null,
    error_message = null,
    extraction_claimed_by = p_claimed_by,
    extraction_claimed_at = now(),
    extraction_heartbeat_at = now(),
    extraction_attempt_count = coalesce(rr.extraction_attempt_count, 0) + 1,
    extraction_next_retry_at = null
  where rr.id = p_run_id
    and rr.status = 'queued'
    and coalesce(rr.extraction_next_retry_at, rr.created_at) <= now()
  returning rr.*;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reset_stale_resume_runs(p_stale_seconds integer DEFAULT 120, p_limit integer DEFAULT 100)
 RETURNS SETOF public.resume_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with stale_runs as (
    select rr.id
    from public.resume_runs rr
    where rr.status = 'extracting'
      and coalesce(rr.extraction_heartbeat_at, rr.extraction_claimed_at, rr.updated_at, rr.created_at)
        <= now() - make_interval(secs => greatest(p_stale_seconds, 1))
    order by rr.created_at asc, rr.id asc
    for update skip locked
    limit greatest(p_limit, 1)
  )
  update public.resume_runs rr
  set
    status = 'queued',
    extraction_claimed_by = null,
    extraction_claimed_at = null,
    extraction_heartbeat_at = null,
    extraction_next_retry_at = now()
  from stale_runs
  where rr.id = stale_runs.id
  returning rr.*;
end;
$function$
;

grant delete on table "public"."extract_worker_heartbeats" to "anon";

grant insert on table "public"."extract_worker_heartbeats" to "anon";

grant references on table "public"."extract_worker_heartbeats" to "anon";

grant select on table "public"."extract_worker_heartbeats" to "anon";

grant trigger on table "public"."extract_worker_heartbeats" to "anon";

grant truncate on table "public"."extract_worker_heartbeats" to "anon";

grant update on table "public"."extract_worker_heartbeats" to "anon";

grant delete on table "public"."extract_worker_heartbeats" to "authenticated";

grant insert on table "public"."extract_worker_heartbeats" to "authenticated";

grant references on table "public"."extract_worker_heartbeats" to "authenticated";

grant select on table "public"."extract_worker_heartbeats" to "authenticated";

grant trigger on table "public"."extract_worker_heartbeats" to "authenticated";

grant truncate on table "public"."extract_worker_heartbeats" to "authenticated";

grant update on table "public"."extract_worker_heartbeats" to "authenticated";

grant delete on table "public"."extract_worker_heartbeats" to "service_role";

grant insert on table "public"."extract_worker_heartbeats" to "service_role";

grant references on table "public"."extract_worker_heartbeats" to "service_role";

grant select on table "public"."extract_worker_heartbeats" to "service_role";

grant trigger on table "public"."extract_worker_heartbeats" to "service_role";

grant truncate on table "public"."extract_worker_heartbeats" to "service_role";

grant update on table "public"."extract_worker_heartbeats" to "service_role";


