# Generation Scaling Plan

## Current Pipeline

Applican now runs resume generation as a single background-worker pipeline:

1. Frontend creates a `resume_run`
2. Extraction completes
3. Frontend enqueues the run into `queued_generate`
4. Generation worker claims the run
5. Generation worker produces bullets and tailored LaTeX
6. Generation worker saves the generated resume artifact
7. Generation worker marks the run `completed`

There is no active PDF worker stage in the current implementation.

## Current Worker Behavior

- `workers/generation/index.ts` is the only active worker entrypoint
- workers use Postgres claim/lease functions for `queued_generate`
- workers heartbeat while a run is actively processing
- stale generation claims can be reset and retried
- one failed run no longer crashes the whole worker process

## Current Metrics

Generation timing is stored in `resume_runs.output.meta.worker_metrics.generation`.

Current fields:

- `load_context_ms`
- `prepare_inputs_ms`
- `generate_bullets_ms`
- `save_output_ms`
- `build_tailored_resume_ms`
- `save_generated_resume_ms`
- `merge_tailored_resume_ms`
- `mark_completed_ms`

## What Still Matters

- generation worker health on Render
- generation queue drain time under load
- OpenAI latency inside `generate_bullets`
- stale-claim tuning via generation lease settings

## Follow-Up Work

1. Measure queue wait time before generation claim.
2. Track p50 and p95 generation duration across runs.
3. Scale generation workers on Render if `queued_generate` backs up.
4. Remove obsolete historical database states and migrations in a future schema cleanup if desired.
