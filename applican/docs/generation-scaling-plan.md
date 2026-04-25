# Generation Scaling Plan

## Goal

Move Applican from browser-driven inline generation to a worker-based pipeline that can reliably handle `20-50` concurrent resume generations without tying long-running work to frontend requests.

## What We Changed Today

### 1. Moved generation orchestration out of the browser hot path

The frontend no longer waits on inline `generate-bullets` calls from the browser.

Current flow:

1. Frontend creates a `resume_run`
2. Extraction completes
3. Frontend enqueues the run into `queued_generate`
4. Frontend waits on run completion by polling run state
5. Workers perform generation + PDF handoff in the background

Key frontend changes:

- `src/features/jobs/hooks/useCreateResumeRun.ts`
- `src/features/jobs/api/enqueueResumeRunForGeneration.ts`
- `src/features/jobs/api/waitForRunCompletion.ts`

### 2. Extracted shared generation logic out of Supabase function wrappers

We pulled business logic into shared server modules so the same code can be used by workers instead of only by Edge Functions.

Key shared modules:

- `src/server/generation/bulletOutput.ts`
- `src/server/generation/normalizeModelOutput.ts`
- `src/server/generation/openAiRequest.ts`
- `src/server/generation/executeGenerateBullets.ts`
- `src/server/generation/executeTailoredResume.ts`
- `src/server/generation/pipeline.ts`
- `src/server/generation/tailoredResume.ts`

### 3. Added worker entrypoints

Added Render-compatible background workers:

- `workers/generation/index.ts`

Scripts:

- `npm run worker:generation`

### 4. Reused DB claim/lease queueing

We kept Supabase/Postgres as the queue and control plane instead of introducing Redis/BullMQ.

Workers now:

- claim runs from `queued_generate` / `queued_pdf`
- heartbeat claimed runs
- reset stale claims
- mark failures
- persist outputs and timing metrics

Key queue modules:

- `src/server/generation/queue.ts`
- `src/server/pdf/queue.ts`

### 5. Generation now completes after LaTeX output is saved

We keep the generated LaTeX artifact in Applican and finish the run once that output is persisted.

### 6. Added timing capture

We now persist worker timing data into `resume_runs.output.meta.worker_metrics`.

Generation metrics currently include:

- `load_context_ms`
- `prepare_inputs_ms`
- `generate_bullets_ms`
- `save_output_ms`
- `build_tailored_resume_ms`
- `save_generated_resume_ms`
- `merge_tailored_resume_ms`
- `queue_pdf_ms`

PDF metrics currently include:

- `load_context_ms`
- `prepare_inputs_ms`
- `compile_pdf_ms`

### 7. Fixed a frontend result rendering bug

The UI was not immediately showing completed results after worker-driven completion.

We fixed that in:

- `src/features/applicationTracker/ui/views/ResumeStudioView.tsx`

Fixes:

- prefer persisted output over stale `createdRun.row.output`
- explicitly clear the completion overlay before showing results

## What We Verified

### Local verification

- `npm run typecheck:server` passed repeatedly during the refactor
- `npm run build` passed after the frontend cutover

### Runtime verification

We verified:

- local workers booted and polled correctly
- frontend localhost submission used the worker-based path
- deployed Render workers claimed jobs
- end-to-end pipeline reached `completed`

Observed pipeline stages in practice:

1. `queued`
2. `extracting`
3. `queued_generate`
4. `generating`
5. `queued_pdf`
6. `compiling_pdf`
7. `completed`

## Current Findings

### Main bottleneck order

Current working order remains:

1. generation
2. PDF compile
3. extraction

### Important observed concurrency

From deployed tests, effective peaks were approximately:

- extraction: `3`
- generation: `5`
- PDF compile: `5`

That means the current deployed system is working concurrently, but is still capped well below the target of `20-50`.

### Current behavior summary

- The architecture is now queue/worker based
- Render workers are claiming work correctly
- The system is no longer serial
- Single-run latency is still high
- Batch throughput is better than serial, but current worker capacity is only around `5`

## Why Single Runs Still Take A Long Time

Scaling and single-run latency are different concerns.

This migration improves:

- horizontal scaling
- queueing
- retries
- stage isolation
- worker ownership of long-running work

It does **not** automatically make one run fast.

A single run still performs, in sequence:

1. extraction
2. bullet generation
3. tailored resume generation
4. PDF compile

So even after this migration, one run can still take around `~100s` if those stages are slow.

## Current Gaps Before Applican Can Handle 20-50 Concurrent Generations Well

### 1. Generation worker capacity is too low

Current effective generation concurrency is about `5`.

To reach `20-50`, we need more generation worker capacity on Render.

### 2. PDF capacity will become the next limiter

PDF compile also peaked around `5`.

Even if generation is scaled up, PDF will bottleneck unless it is scaled too.

### 3. We still need better measurement separation inside generation

We know generation is slow, but we still need sharper answers on:

- `generate-bullets`
- `generate-tailored-resume`
- queue wait time before claim
- any OpenAI/provider-side throttling

### 4. Worker health and crash handling need more hardening

We observed at least one Render instance exit with status `1`.

Even though runs completed, worker instance stability needs to be improved before trusting higher concurrency.

## What Needs To Be Done Next

## Priority 1: Stabilize the deployed worker fleet

- Confirm Render generation worker instance count
- Confirm Render PDF worker instance count
- Inspect crash logs for any worker exits
- Make sure all worker instances are healthy and running the same code/config

## Priority 2: Add clearer queue and latency measurement

Add or compute:

- queue wait to generation claim
- queue wait to PDF claim
- per-run generation total
- per-run PDF total
- aggregate p50 / p95 timings across runs

This can live in either:

- `resume_runs.output.meta.worker_metrics`
- a separate analytics/metrics table

## Priority 3: Scale generation workers on Render

Target:

- increase active generation worker capacity beyond current `~5`

Measure after each change:

- peak `generating`
- time spent in `queued_generate`
- total drain time for `10`, `20`, and `50`

Success condition:

- peak `generating` rises meaningfully above `5`
- `queued_generate` backs up less
- total drain time grows sublinearly with batch size

## Priority 4: Scale PDF worker/service capacity too

After generation is scaled, PDF will likely become the next queue wall.

Need to monitor:

- `queued_pdf`
- `compiling_pdf`
- total PDF drain time

Then scale:

- Applican PDF worker count
- ResumeEditor compile service capacity if needed

## Priority 5: Separate generation substage timings more explicitly

Right now generation is still a broad bucket operationally.

We should explicitly track:

- `generate_bullets_ms`
- `generate_tailored_resume_ms`
- total OpenAI request time per stage
- any retries / provider errors

That will answer whether the real drag is:

- bullet generation
- tailored resume generation
- or orchestration overhead between them

## Priority 6: Improve retry behavior

Currently worker failure handling exists, but transient failures should be requeue-aware instead of always terminal.

We should support:

- transient OpenAI failures -> requeue with attempt cap
- transient compile failures -> requeue with attempt cap
- permanent validation/data failures -> mark failed immediately

## Recommended Near-Term Test Plan

1. Keep local workers off
2. Run deployed `count=10`
3. Inspect final summary and worker metrics JSON
4. Increase generation worker scale
5. Run deployed `count=10` again
6. Run deployed `count=20`
7. If healthy, run deployed `count=50`

At each step, record:

- total elapsed drain time
- peak extracting
- peak generating
- peak compiling_pdf
- completed vs failed count
- whether any workers crashed

## Current Target Architecture

### Applican frontend

- create run
- upload resume
- wait for extraction
- enqueue generation
- render completed results from persisted run output

### Supabase/Postgres

- system of record
- queue state
- claim/lease functions
- job status tracking
- persisted worker metrics

### Render generation workers

- claim `queued_generate`
- run bullets generation
- run tailored resume generation
- write outputs
- mark `queued_pdf`

### Render PDF workers

- claim `queued_pdf`
- call existing compile function/service
- wait for compile completion path

### ResumeEditor compile service

- compile LaTeX
- upload/store PDF
- mark final completion

## Bottom Line

Today’s work successfully moved Applican onto a real worker-based generation pipeline.

The system now:

- works end-to-end
- scales better than browser-inline generation
- uses Render workers correctly
- persists timing metrics
- integrates with the existing PDF compile service

But it is **not yet at the target capacity**.

Current effective concurrency is around `5`.

To reach `20-50` concurrent generations, the next work is:

1. stabilize worker health
2. scale generation workers
3. scale PDF capacity
4. measure queue wait and per-substage latency more precisely
5. rerun load tests at `10`, `20`, and `50`
