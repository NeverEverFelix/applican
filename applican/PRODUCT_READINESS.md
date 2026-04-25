# Applican Product Readiness

Assessment date: 2026-04-25

Scope note:
- `career path` is intentionally out of scope
- `resources` is intentionally out of scope

## Overall

`applican` looks like a real MVP rather than a prototype.

Current assessment:
- MVP completeness: `80-90%`
- Production readiness: `60-75%`

## Why It Looks MVP-Complete

- The core user loop exists: upload resume, extract content, generate tailored output, and produce a tailored resume/PDF.
- Auth/account flow appears present enough for normal use.
- The backend pipeline is structured and operational, not just stitched together with ad hoc scripts.
- Extraction and generation now run with meaningful concurrency.
- Observability is good enough to distinguish internal failures from provider-side limits.

## What Is Strong

- Core value delivery is present.
- Scaling work materially improved throughput.
- Generation timing is now measured in detail.
- Failure causes are more visible than before.
- The system has moved past toy-stage bottlenecks and is now hitting realistic provider constraints.

## What Still Keeps It Below A Stronger Product

- OpenAI rate-limit handling still needs more hardening under burst load.
- Queue shaping and dispatch control can be improved further.
- Failure recovery and retry behavior likely still need polish across all stages.
- Operational guardrails are still maturing.
- UX around retries, waiting states, and partial failures likely needs refinement.
- Admin/support/debug workflows are probably not fully mature yet.

## Launch Buckets

### Launch Now

- Core resume extraction flow
- Core tailored generation flow
- Tailored resume build/PDF path
- Basic user-facing workflow for the main use case

### Should Fix Before Public Launch

- Provider rate-limit resilience under burst load
- More predictable generation dispatch and backoff behavior
- Clearer failure handling for end users
- Better protection against partial pipeline failures
- Final pass on operational visibility and alerts

### Can Wait Until After Launch

- More advanced admin/internal tooling
- Deeper analytics/reporting
- Broader UX polish beyond the core funnel
- Further scaling improvements after real usage data arrives

## Bottom Line

If the intended product is the resume tailoring/generation workflow itself, `applican` is basically at MVP level now.

It is not fully polished as a broad production product yet, but it is clearly beyond early prototype stage. The remaining work is mostly hardening, operational control, and launch polish rather than proving the core product.
