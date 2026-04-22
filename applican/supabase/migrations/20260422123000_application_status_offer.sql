alter table "public"."applications" drop constraint if exists "applications_status_check";

alter table "public"."applications"
add constraint "applications_status_check"
check (
  status = any (
    array[
      'Applied'::text,
      'Offer'::text,
      'Interview #1'::text,
      'Interview #2'::text,
      'Interview #3'::text,
      'Interview #4'::text,
      'Interview #5'::text,
      'Interview #6'::text,
      'Interview #7'::text,
      'Interview #8'::text,
      'Rejected'::text,
      'Ready To Apply'::text
    ]
  )
);
