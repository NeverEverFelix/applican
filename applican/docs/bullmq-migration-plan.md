# BullMQ Migration Plan

## Goal

Migrate Applican's generation queue from the current Postgres claim/lease model to a Redis-backed BullMQ queue, while keeping Supabase as the canonical product-state store.

This is a queueing and worker-orchestration migration, not a generation-pipeline rewrite.

## Current State

Today the generation pipeline works like this:

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

Current Postgres queue features:

- claim-next-run via RPC
- stale-claim reset via RPC
- heartbeat columns on `resume_runs`
- status transitions stored directly in the DB

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

## What Stays Canonical

Supabase should remain the canonical product-state store.

That means:

- users still read run status from `resume_runs`
- generated artifacts still live in Supabase-backed storage/data tables
- worker metrics can still be written back to `resume_runs.output.meta`

BullMQ should be the execution queue, not the user-facing state model.

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

## Migration Phases

## Phase 1: Introduce BullMQ Infrastructure

Add:

- Redis connection config
- BullMQ queue module
- BullMQ worker bootstrap
- env vars for Redis and queue behavior

Suggested new modules:

- `src/server/queue/bullmq.ts`
- `src/server/queue/generationQueue.ts`

## Phase 2: Migrate Enqueue

Update the generation enqueue path so it writes both:

- DB state: `queued_generate`
- queue state: BullMQ `generation` job

Likely touch:

- [src/features/jobs/api/enqueueResumeRunForGeneration.ts](/Users/felixm/Desktop/applican/applican/src/features/jobs/api/enqueueResumeRunForGeneration.ts:1)

## Phase 3: Add a BullMQ Generation Worker

Refactor the current generation worker so the processing body stays mostly the same, but the claim loop disappears.

Likely work in:

- [workers/generation/index.ts](/Users/felixm/Desktop/applican/applican/workers/generation/index.ts:1)

Expected removals or reductions:

- `claimNextGenerateRun`
- `resetStaleGenerateRuns`
- polling sleep loop
- DB heartbeat timer as queue control

Expected additions:

- BullMQ `Worker`
- BullMQ job handlers
- explicit job-level error handling

## Phase 4: Add Idempotency Guards

Before processing a BullMQ job:

- if the run is already `completed`, no-op
- if the run is already being processed safely elsewhere, no-op or fail fast
- if duplicate jobs exist, ensure only one result wins cleanly

This keeps retries safe and avoids duplicate artifacts.

## Phase 5: Cut Over

Deploy BullMQ-backed workers and stop using the Postgres generation claim loop for new traffic.

During cutover:

- keep writing DB statuses as before
- monitor queue depth, retries, failures, and completion times
- leave old generation claim migrations/functions in place temporarily

## Phase 6: Cleanup

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

- `20`-job bursts look fine on the current system
- `50`-job bursts complete reliably but clearly queue in waves

That means BullMQ is not emergency work yet, but it is reasonable next-stage scaling infrastructure.

## Recommended Order

1. Add queue metrics and backpressure to the current setup.
2. Design and introduce BullMQ infrastructure.
3. Migrate generation first.
4. Leave extraction on the current system unless it also starts hitting queue-management pain.
5. Clean up Postgres claim/lease generation code after the BullMQ path proves stable.

## Naming Decision

Use the name `BullMQ` in docs and implementation.

Recommended queue name:

- `generation`

Recommended infra language:

- "BullMQ-backed generation queue"
- "Redis-backed BullMQ worker"

