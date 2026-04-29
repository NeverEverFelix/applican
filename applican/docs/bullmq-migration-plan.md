# BullMQ Migration Plan

## Goal

Migrate Applican's generation queue from the current Postgres claim/lease model to a Redis-backed BullMQ queue, while keeping Supabase as the canonical product-state store.

This is a queueing and worker-orchestration migration, not a generation-pipeline rewrite.

## Current State

As of April 25, 2026, the current generation system has two important properties:

- it is reliable under burst load
- its main latency bottleneck is OpenAI roundtrip time, not local worker compute

The current generation pipeline works like this:

1. Frontend creates a `resume_run`
2. Extraction completes
3. Applican marks the run `queued_generate`
4. The generation worker claims work from Postgres RPC
5. The worker heartbeats the claim in `resume_runs`
6. The worker runs bullet generation and tailored resume generation
7. The worker writes artifacts and marks the run `completed` or `failed`

Current generation queue mechanics live in:

- [workers/generation/index.ts](/Users/felixm/Desktop/applican/applican/workers/generation/index.ts:1)
- [src/server/generation/queue.ts](/Users/felixm/Desktop/applican/applican/src/server/generation/queue.ts:1)

Current request-shaping logic for OpenAI lives in:

- [src/server/generation/openAiRequest.ts](/Users/felixm/Desktop/applican/applican/src/server/generation/openAiRequest.ts:1)
- [src/server/generation/executeGenerateBullets.ts](/Users/felixm/Desktop/applican/applican/src/server/generation/executeGenerateBullets.ts:1)

Current Postgres queue features:

- claim-next-run via RPC
- stale-claim reset via RPC
- heartbeat columns on `resume_runs`
- status transitions stored directly in the DB

## What Changed Before BullMQ

Before starting BullMQ, Applican improved the actual OpenAI request payload without changing the output contract.

That work included:

- shortening job description prompt input
- trimming non-experience resume context more aggressively
- removing duplicated low-value prompt instructions
- preserving the existing JSON schema and output structure

The relevant code is in:

- [src/server/generation/openAiRequest.ts](/Users/felixm/Desktop/applican/applican/src/server/generation/openAiRequest.ts:1)

That work mattered because recent metrics showed that:

- `generate_bullets_ms ~= openai_roundtrip_ms`
- model normalization is negligible
- local worker compute is not the main bottleneck

In other words: BullMQ will improve queue orchestration, retries, and observability, but it will not make OpenAI itself faster.

## Recent Performance Snapshot

On April 25, 2026, generation metrics improved materially after shrinking prompt payloads.

Recent `metrics:generation` summary:

- total generation avg: about `13.4s`
- total generation p50: about `11.8s`
- total generation p95: about `19.2s`
- generate bullets avg: about `13.1s`
- OpenAI roundtrip avg: about `13.1s`

Recent burst test examples:

- `20/20` completed in about `42.1s`
- `50/50` completed in about `77.9s`
- earlier `100/100` completed in about `308.8s` before the prompt-size improvement work

Interpretation:

- the current system is stable
- the current queue degrades by queueing, not by crashing
- BullMQ is now a cleaner scaling and operations step, not an emergency latency fix

## What BullMQ Would Replace

BullMQ would replace the queue execution layer:

- Postgres polling
- Postgres claim/lease logic
- manual stale-claim recovery as the primary retry path
- worker-slot polling loops for generation

BullMQ would not replace:

- `resume_runs` as the source of truth for UI state
- Supabase storage/artifact writes
- OpenAI generation logic
- parser / preparation / tailored resume code
- prompt-shaping work in `openAiRequest.ts`

## What Stays Canonical

Supabase should remain the canonical product-state store.

That means:

- users still read run status from `resume_runs`
- generated artifacts still live in Supabase-backed storage/data tables
- worker metrics can still be written back to `resume_runs.output.meta`

BullMQ should be the execution queue, not the user-facing state model.

## Why BullMQ Still Makes Sense

BullMQ is still valuable even after the OpenAI payload optimizations.

The reason is not "the current queue is broken."

The reason is that BullMQ would give Applican cleaner control over:

- waiting vs active jobs
- retries and backoff
- backlog visibility
- delayed jobs
- future priorities
- explicit dead-letter handling
- cleaner worker coordination under burst traffic

This is especially relevant now that Applican has already addressed a meaningful chunk of raw OpenAI latency. The next infra improvement should target queue semantics and observability, not try to outsmart model latency inside the current Postgres claim loop.

## Target Architecture

### Queue

Create a BullMQ queue named `generation`.

Each BullMQ job should contain a minimal payload:

- `runId`
- `userId`
- `requestId`
- optional enqueue timestamp/version metadata

### Enqueue Path

When generation is requested:

1. update `resume_runs.status = 'queued_generate'`
2. set `generation_queued_at`
3. enqueue a BullMQ job for that run

This preserves the current product semantics while moving execution scheduling into Redis.

### Worker Path

The BullMQ worker should:

1. receive a job
2. load the run context from Supabase
3. atomically mark the run `generating`
4. execute the existing generation pipeline
5. save generated artifacts
6. mark the run `completed` or `failed`

### Retry Path

Retries should be split across two levels:

- request-level retries inside the OpenAI execution code
- job-level retries/backoff in BullMQ

BullMQ should own:

- attempts
- backoff policy
- delayed retries
- dead-letter/failure visibility

The request-level OpenAI retry logic already belongs in the generation execution layer and should remain there.

## Migration Phases

### Phase 1: Introduce BullMQ Infrastructure

Add:

- Redis connection config
- BullMQ queue module
- BullMQ worker bootstrap
- env vars for Redis and queue behavior

Suggested new modules:

- `src/server/queue/bullmq.ts`
- `src/server/queue/generationQueue.ts`

### Phase 2: Migrate Enqueue

Update the generation enqueue path so it writes both:

- DB state: `queued_generate`
- queue state: BullMQ `generation` job

Likely touch:

- [src/features/jobs/api/enqueueResumeRunForGeneration.ts](/Users/felixm/Desktop/applican/applican/src/features/jobs/api/enqueueResumeRunForGeneration.ts:1)

### Phase 3: Add a BullMQ Generation Worker

Status: completed.

The active generation worker now consumes BullMQ jobs and starts runs by `runId` instead of polling Postgres for claims.

Primary runtime pieces:

- [workers/generation/index.ts](/Users/felixm/Desktop/applican/applican/workers/generation/index.ts:1)
- [workers/generation-enqueuer/index.ts](/Users/felixm/Desktop/applican/applican/workers/generation-enqueuer/index.ts:1)
- [src/server/queue/generationQueue.ts](/Users/felixm/Desktop/applican/applican/src/server/queue/generationQueue.ts:1)
- [supabase/functions/request-generation-enqueue/index.ts](/Users/felixm/Desktop/applican/applican/supabase/functions/request-generation-enqueue/index.ts:1)

Expected removals or reductions:

- `claimNextGenerateRun`
- `resetStaleGenerateRuns`
- polling sleep loop
- DB heartbeat timer as queue control

Expected additions:

- BullMQ `Worker`
- BullMQ job handlers
- explicit job-level error handling

### Phase 4: Add Idempotency Guards

Before processing a BullMQ job:

- if the run is already `completed`, no-op
- if the run is already being processed safely elsewhere, no-op or fail fast
- if duplicate jobs exist, ensure only one result wins cleanly

This keeps retries safe and avoids duplicate artifacts.

### Phase 5: Cut Over

Deploy BullMQ-backed workers and stop using the Postgres generation claim loop for new traffic.

During cutover:

- keep writing DB statuses as before
- monitor queue depth, retries, failures, and completion times
- leave old generation claim migrations/functions in place temporarily

### Phase 6: Cleanup

After stable production soak:

- remove old Postgres claim/reset generation flow
- deprecate unused queue columns/functions if desired

Candidates for cleanup later:

- `claim_next_generate_run`
- `reset_stale_generate_runs`
- `generation_claimed_by`
- `generation_claimed_at`
- `generation_heartbeat_at`

Do not remove these immediately during cutover.

## File-Level Impact

Most likely touched files:

- [workers/generation/index.ts](/Users/felixm/Desktop/applican/applican/workers/generation/index.ts:1)
- [src/server/generation/queue.ts](/Users/felixm/Desktop/applican/applican/src/server/generation/queue.ts:1)
- [src/features/jobs/api/enqueueResumeRunForGeneration.ts](/Users/felixm/Desktop/applican/applican/src/features/jobs/api/enqueueResumeRunForGeneration.ts:1)

Most likely new files:

- `src/server/queue/bullmq.ts`
- `src/server/queue/generationQueue.ts`
- possibly `workers/generation/processor.ts` if processing logic is split cleanly from worker bootstrap

## Operational Benefits

BullMQ would give Applican better control over:

- waiting vs active vs failed jobs
- retries and backoff
- backlog visibility
- delayed jobs
- future priorities
- cleaner worker coordination under burst traffic

It would not make OpenAI itself faster.

It would make queue behavior more explicit, observable, and easier to control.

## When This Migration Is Worth It

Based on current testing:

- the current system is good enough for current-stage traffic
- prompt-size optimization meaningfully improved latency
- manual worker scaling is still viable
- the queue now behaves like a real orchestration layer worth formalizing

That means BullMQ is not emergency work, but it is now a legitimate next-step infra project if Applican wants cleaner scaling, retries, and operational visibility.

## Recommended Order

1. Keep the current prompt-size optimizations.
2. Manually validate output quality across representative resumes and job descriptions.
3. Preserve the existing worker runtime behavior that is currently benchmarking well.
4. Introduce BullMQ infrastructure without trying to re-tune queue behavior inside the Postgres model first.
5. Migrate generation first.
6. Leave extraction on the current system unless it also starts hitting queue-management pain.
7. Clean up Postgres claim/lease generation code after the BullMQ path proves stable.

## Naming Decision

Use `BullMQ` explicitly in code comments, docs, and rollout planning.
