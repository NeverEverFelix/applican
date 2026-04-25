# Performance Work Summary - 2026-04-25

## Scope

This document summarizes the performance, scaling, and reliability work completed on April 25, 2026 across:

- `applican`
- `ApplicanRAG`
- `ResumeExtract`

## What We Changed

### Applican

- Added broader retry handling in `src/server/generation/executeGenerateBullets.ts`.
- Generation retries now cover:
  - HTTP `429`
  - transient OpenAI `5xx`
  - network/fetch failures
- Added tests in `src/server/generation/executeGenerateBullets.test.ts` for:
  - transient `5xx` retry behavior
  - network retry behavior
- Verified those tests with:
  - `npm test -- executeGenerateBullets.test.ts`
- Updated local `.env` to use:
  - `OPENAI_MODEL=gpt-4.1-mini`

### ApplicanRAG

- Added ANN index migration:
  - `supabase/migrations/20260425120500_add_embeddings_ann_index.sql`
- Added `WEB_CONCURRENCY` support to the Dockerized API process.
- Updated deployment docs to reflect that concurrency setting.
- Switched Supabase REST calls to pooled `httpx`.
- Added retry/backoff logic to the Supabase REST client.
- Switched the OpenAI embeddings path to shared `httpx` with retry/backoff.
- Added or updated tests for:
  - Supabase REST behavior
  - embeddings client behavior
- Verified the relevant test suite in the repo venv.

### ResumeExtract

- Investigated extraction throughput and confirmed the important extraction controls were:
  - `WEB_CONCURRENCY`
  - `EXTRACTION_WORKER_CONCURRENCY`
- Confirmed effective extraction fan-out was driven by attached workers per web process.
- Used that to interpret extraction ceilings during burst tests.

## Configuration Work

### Generation Settings Tuned

These settings were actively evaluated:

- `GENERATION_WORKER_CONCURRENCY`
- `GENERATION_POLL_INTERVAL_MS`
- `OPENAI_RATE_LIMIT_MAX_RETRIES`
- `OPENAI_RATE_LIMIT_RETRY_BASE_DELAY_MS`
- `OPENAI_MODEL`

### Extraction Settings Evaluated

These settings were discussed and validated against observed throughput:

- `WEB_CONCURRENCY`
- `EXTRACTION_WORKER_CONCURRENCY`

## What We Learned

### OpenAI Rate Limits Were a Real Bottleneck

- Earlier generation logs showed OpenAI TPM saturation on `gpt-4.1`.
- That explained a set of failed runs and long-tail slowdowns.
- Changing the model to `gpt-4.1-mini` was part of stabilizing generation.

### Extraction Improved and Stopped Being the Main Constraint

- Extraction peaks reached the low-to-mid teens during testing.
- Once extraction could feed generation consistently, generation became the dominant bottleneck.

### Generation Sweet Spot Matters More Than Raw Concurrency

- Higher concurrency was not always better.
- A run with more aggressive generation settings produced a long-tail slowdown where requests stayed in `generating` for too long.
- A later run at `GENERATION_WORKER_CONCURRENCY=9` produced a strong result:
  - `20/20 completed`
  - `0 failed`
  - roughly `37.3s` total
  - `peak_generating_so_far: 20`
  - `peak_extracting_so_far: 14`

### Stable Baseline Identified

As of the end of the work session, the best observed practical generation setting was:

- `GENERATION_WORKER_CONCURRENCY=9`

With the current supporting settings:

- `GENERATION_POLL_INTERVAL_MS=200`
- `OPENAI_RATE_LIMIT_MAX_RETRIES=3`
- `OPENAI_RATE_LIMIT_RETRY_BASE_DELAY_MS=750`
- `OPENAI_MODEL=gpt-4.1-mini`

## What We Achieved

- Improved generation resilience to transient OpenAI/API failures.
- Added test coverage for retry behavior in the main generation path.
- Added an ANN index migration for vector search performance in `ApplicanRAG`.
- Reduced connection overhead in `ApplicanRAG` by switching to pooled `httpx`.
- Added retry/backoff behavior to both Supabase and embeddings clients in `ApplicanRAG`.
- Identified that OpenAI latency and rate limiting, not just local worker count, were major throughput constraints.
- Found a burst-tested generation configuration that completed `20/20` jobs in about `37s` with no failures.

## Practical Capacity Estimate Discussed

This was framed as a rough operating estimate, not a guarantee.

- Conservative estimate: `~500 DAU`
- Plausible estimate with reasonably smooth traffic: `~1,000 DAU`
- Upper-end optimistic estimate with low burstiness: `~2,000 DAU`

Important note:

- DAU is not the real bottleneck variable.
- Burst concurrency around resume generation is what actually determines stress on the system.

## Recommended Next Work

### 1. Add Better Measurement

- Log and inspect `queue_wait_ms`, OpenAI time, total generation time, retry count, and payload size.
- Track p50, p95, and p99 for extraction and generation separately.
- Track generation in-flight concurrency over time.

### 2. Reduce Work Per Request

- Trim prompt/input size where possible.
- Avoid sending unnecessary resume or job-description text.
- Cache deterministic preprocessing where appropriate.

### 3. Add Smarter Backpressure

- Add a soft global cap for active OpenAI calls.
- Avoid flooding generation when in-flight requests are already high.
- Prefer controlled claim/backoff behavior over all-at-once bursts.

### 4. Validate With More Load Shapes

- Repeat the `20`-job burst multiple times at the chosen config.
- Run `40`-job and `80`-job burst tests.
- Compare failure rates and long-tail behavior, not just average completion time.

## Current Recommendation

For now, keep the current generation setup at:

- `GENERATION_WORKER_CONCURRENCY=9`

Do not increase it again until repeated burst tests confirm the setting is stable across multiple runs.
