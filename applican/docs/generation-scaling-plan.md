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
- a generation worker process can now run multiple claim loops in parallel via `GENERATION_WORKER_CONCURRENCY`
- idle worker slots sleep only when no work is available; successful slots immediately claim the next run

## Current Metrics

Generation timing is stored in `resume_runs.output.meta.worker_metrics.generation`.

Current fields:

- `queue_wait_ms`
- `load_context_ms`
- `prepare_inputs_ms`
- `generate_bullets_ms`
- `save_output_ms`
- `build_tailored_resume_ms`
- `save_generated_resume_ms`

## What Still Matters

- generation worker health on Render
- generation queue drain time under load
- OpenAI latency inside `generate_bullets`
- stale-claim tuning via generation lease settings
- PDF compilation throughput if runs are still being advanced into `queued_pdf` and `compiling_pdf` outside the current worker code

## Latest Load Test Read

The latest run reached:

- `peak_generating_so_far: 5`
- `peak_extracting_so_far: 3`
- 20 total completions after about 203.6 seconds

That pattern says generation concurrency is currently capped by available active worker slots rather than by the database claim function. The repeated `generation_claimed_by_counts` distribution also shows five long-lived claimers carrying the batch instead of workers continuously backfilling beyond that level.

## New Scaling Knobs

- `GENERATION_WORKER_CONCURRENCY`: number of parallel claim/process loops per worker process
- `GENERATION_POLL_INTERVAL_MS`: idle backoff when no queued generation work is available
- `GENERATION_STALE_SECONDS`: lease duration before a generation claim is treated as stale
- `GENERATION_STALE_LIMIT`: max stale generation claims reset per loop iteration

## New Queue Metric

Generation enqueue now records `generation_queued_at` on the `resume_runs` row. When the worker completes a run, it saves `queue_wait_ms` into `resume_runs.output.meta.worker_metrics.generation`, giving a direct measure of how long work sat in `queued_generate` before a worker claimed it.

## Follow-Up Work

1. Redeploy the generation worker with `GENERATION_WORKER_CONCURRENCY` set above `1`; start with `4` to `8` per instance and re-run the same batch test.
2. Measure queue wait time from `queued_generate` to first generation claim so scaling decisions are based on backlog, not just completion time.
3. Track p50 and p95 generation duration across runs and split the report by `generate_bullets_ms` versus local save/build stages.
4. If generation rises above current extraction or PDF throughput, scale those stages separately instead of continuing to increase generation slots.
5. Remove obsolete historical database states and migrations in a future schema cleanup if desired.
