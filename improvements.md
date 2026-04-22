# Frontend Polish Baseline

## 1. Responsive layout
- Replace fixed pixel-only widths/heights in key containers with responsive rules.
- Add breakpoints for desktop, laptop, tablet, and mobile.
- Verify `studioContainer` and Resume Studio flows do not overflow on smaller screens.

## 2. State completeness
- Ensure every async workflow clearly supports `idle`, `loading`, `success`, and `error`.
- Add explicit empty states for views that can have no data (results, trackers, lists).
- Keep state transitions predictable and visually distinct.

## 3. Form and input UX
- Add client-side validation for resume upload (type and max size).
- Validate job description input for blank/minimum useful content.
- Show targeted inline validation messages near the relevant field.

## 4. Accessibility baseline
- Ensure all interactive elements are keyboard reachable and operable.
- Add clear visible focus styles for keyboard users.
- Confirm proper labels/ARIA roles for custom controls and async status updates.

## 5. Visual consistency
- Standardize spacing, border radius, font sizes, and control sizing.
- Centralize design tokens (colors, spacing, typography) in CSS variables.
- Align copy tone and microcopy style across states and views.

## 6. Performance hygiene
- Optimize large assets (images/fonts) and remove unused ones.
- Investigate current bundle-size warning and split heavy code paths where reasonable.
- Avoid loading non-critical assets on initial render.

## 7. Reliability UX
- Add clear fallback messaging for backend/API outages.
- Provide retry affordances on failure-prone flows.
- Preserve key user inputs during refresh/navigation.

## 8. Production visibility
- Add frontend error monitoring (e.g., Sentry) for runtime issues.
- Add basic analytics events for key actions (generate click, success, failure, signup/login).
- Track funnel drop-off points to guide future UX improvements.


For this app, the right number is not “concurrent users on the website,” it’s “concurrent resume-generation pipelines.” The frontend itself can support a lot more passive users than the backend can support active jobs.

From the code, the expensive path is:
upload -> row insert -> extraction worker -> generate-bullets edge function -> generate-tailored-resume -> PDF compile -> storage/history
See createResumeRun.ts, waitForRunExtraction.ts, generate-bullets/index.ts, and generate-tailored-resume/index.ts.

A good way to think about scaling:

100-500 concurrent signed-in users browsing is not a scary number if only a small fraction are generating.
10-20 concurrent active resume generations is a reasonable first serious target.
25-50 concurrent active generations is a strong next milestone for this architecture.
Above that, you should expect queueing, rate limits, and worker bottlenecks unless you redesign the job pipeline.
Good ideas for scaling, without changing product behavior:

Separate “request accepted” from “job running.” Put generation behind an explicit queue instead of doing too much inline in edge functions.
Treat extraction, AI analysis, LaTeX/PDF compile, and download URL creation as separate jobs with statuses.
Add per-user concurrency limits. For example: 1 active generation per user, maybe 2 for paid.
Add global backpressure. If the queue is full, tell the user their job is queued instead of letting timeouts pile up.
Replace aggressive polling with realtime status updates or at least slower/adaptive polling. Right now waitForRunExtraction.ts polls every 1.5s, which gets expensive under load.
Make every step idempotent. You already have some idempotency work in migrations; keep leaning into that so retries are safe.
Cache or reuse artifacts where possible: parsed resume text, generated LaTeX, signed URLs, prior job-description analysis.
Split the heavy services so one spike in PDF compile doesn’t block AI generation.
Put hard observability around each stage: queue depth, step latency, failure rate, retries, and cost per successful run.
If you want one concrete planning number: I’d design v1 operations around 20 concurrent active generations and prove you can keep median completion time acceptable there. That probably corresponds to roughly 100-300 people online at once, depending on how many are actively generating versus just viewing history/editor pages.

The metric to watch is:
concurrent active generations, not total connected users.

If you want, I can turn this into a simple capacity model for your stack, like “if one generation takes X seconds and Y OpenAI calls, here’s what 10/25/50 concurrent jobs implies.”





11:19 PM
