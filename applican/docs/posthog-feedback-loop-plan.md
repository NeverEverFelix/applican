# Applican PostHog Feedback Loop Plan

## Date 

April 27, 2026

## Context

Today we focused on turning Applican's PostHog dashboard into a product analytics foundation. The goal was not to add more code yet. The goal was to organize the events Applican already captures into useful product-development views, then define the next layer of result-quality instrumentation.

Applican already has a working PostHog setup through `src/posthog.ts` and a `captureEvent` helper. The product flow also already emits several useful lifecycle events from the resume run flow, including run creation, extraction, generation, cancellation, and results viewing.

## Current Product Analytics Goal

Applican needs a feedback loop that helps answer three product questions:

1. Are users reaching the first real value moment?
2. Is the generation pipeline reliable and fast enough?
3. After users view results, do they actually find the output useful?

The first two can be measured with existing events. The third requires new result-engagement events that will be implemented later.

## Dashboard Work Completed Today

### 1. Core Activation Funnel

Purpose: Measure whether users reach the first real value moment.

Funnel steps:

```text
run_created -> extract_succeeded -> rag_succeeded -> results_viewed
```

Recommended name:

```text
Core Activation Funnel
```

Description:

```text
Tracks whether users successfully complete the main Applican flow: create a resume run, finish extraction, complete AI generation, and view the results.
```

Why this matters:

This is the main activation funnel because `results_viewed` means the user has reached generated output. `rag_succeeded` only proves the system finished generation. `results_viewed` proves the user reached the value moment.

### 2. Generation Reliability Funnel

Purpose: Measure whether the backend/product generation pipeline completes successfully.

Funnel steps:

```text
run_created -> extract_started -> extract_succeeded -> rag_started -> rag_succeeded
```

Recommended name:

```text
Generation Reliability Funnel
```

Description:

```text
Tracks whether each resume run successfully moves from creation through extraction and AI generation.
```

Important note:

We decided not to use `has_job_description` or `has_resume_file` as breakdowns because Applican requires a resume and job description combo. Those are invariants, not useful segmentation variables.

Useful future breakdowns would be things that can actually vary and explain issues, such as browser, device type, resume file type, user plan, job-description length bucket, or error code.

### 3. Generation Failure Events

Purpose: Track where the generation system breaks or where users abandon a run.

Insight type:

```text
Trends
```

Events:

```text
extract_failed
rag_failed
run_cancelled
```

Recommended chart type:

```text
Bar chart
```

Recommended name:

```text
Generation Failure Events
```

Description:

```text
Tracks extraction failures, AI generation failures, and cancelled runs so reliability issues are visible separately from successful activation.
```

Why this matters:

The reliability funnel shows successful pipeline completion. This failure trend shows the opposite side: extraction issues, RAG issues, and abandoned runs.

### 4. Results Viewed

Purpose: Track how often users reach the results screen.

Insight type:

```text
Trends
```

Event:

```text
results_viewed
```

Recommended chart type:

```text
Bar chart
```

Recommended name:

```text
Results Viewed
```

Description:

```text
Tracks how often users reach the results screen after generation completes. This is the current proxy for output value until deeper result interaction events are added.
```

Why this matters:

Until deeper result interaction events exist, `results_viewed` is the closest available proxy for whether users reached the product's output.

### 5. Time to First Result

Purpose: Measure speed and time to value.

Insight type:

```text
Funnels
```

Funnel steps:

```text
run_created -> results_viewed
```

Recommended name:

```text
Time to First Result
```

Description:

```text
Measures how long users take to go from creating a resume run to viewing generated results.
```

Important note:

This should be a funnel, not a trends chart. A trends chart only shows event occurrences. The funnel view can show conversion time, median conversion time, or detailed time-to-convert between `run_created` and `results_viewed`.

Why this matters:

Applican's product promise depends heavily on speed. If the product claims users can tailor applications quickly, time to first result becomes a core proof point.

### 6. Results Viewed by Referrer

Purpose: Measure which acquisition sources produce real product usage.

Insight type:

```text
Trends
```

Event:

```text
results_viewed
```

Breakdown:

```text
$referring_domain
```

Recommended name:

```text
Results Viewed by Referrer
```

Description:

```text
Shows which traffic sources are producing users who reach generated results, not just visitors.
```

Why this matters:

Traffic alone is not useful if visitors do not reach results. This card helps distinguish low-quality traffic from sources that create activated users.

If `$referring_domain` is empty or mostly self-referrals, use `$current_url` or another source property later.

### 7. Signup to Activation Funnel

Purpose: Measure whether new users move from signup into real product usage.

Insight type:

```text
Funnels
```

Funnel steps:

```text
signup_completed -> run_created -> results_viewed
```

Recommended name:

```text
Signup to Activation Funnel
```

Description:

```text
Tracks whether new users move from account creation to starting a resume run and viewing generated results.
```

Why this matters:

Signup is not the real product milestone. Activation happens when a user views generated results.

## What We Decided Not to Do Today

### No redundant Run Outcomes card

We considered a `Run Outcomes` card using:

```text
rag_succeeded
extract_failed
rag_failed
run_cancelled
```

But this was too similar to the existing reliability funnel plus the failure-events trend. We skipped it to keep the dashboard clean.

### No meaningless breakdowns

We rejected breakdowns like:

```text
has_job_description
has_resume_file
```

Reason: Applican requires both resume and job description input. These are not useful segments because they do not meaningfully vary in normal use.

### No fake result-engagement dashboard yet

We did not create charts for events that do not exist yet, such as bullet copying, download behavior, or editor usage. Those require instrumentation first.

## Tomorrow's Coding Goals

The main coding task is to instrument result engagement events so Applican can measure whether generated outputs are actually useful.

### Events to add

```text
optimization_section_expanded
optimized_bullet_copied
resume_downloaded
latex_editor_opened
resume_edited
new_run_started
```

Optional later event:

```text
bullet_expanded
```

Only add this if there is a separate bullet-level expansion UI. If section expansion already reveals bullets, `optimization_section_expanded` may be enough.

### Required event properties

Every result interaction event should include enough context to connect the interaction back to a specific generated output.

Recommended properties:

```ts
{
  run_id,
  request_id,
  section_id,
  section_kind,
  bullet_id,
  job_title,
  match_score,
  action
}
```

Example:

```ts
captureEvent("optimized_bullet_copied", {
  run_id,
  request_id,
  section_id: "exp:0",
  section_kind: "experience",
  bullet_id: "exp:0:2",
  job_title: "Product Support Engineer",
  match_score: 87,
});
```

### Why these properties matter

The goal is not just to count clicks. The goal is to know which generated resume outputs users actually used.

If a user copies a bullet, Applican should know:

- which run created it
- which section it belonged to
- which bullet was copied
- what role/job title it targeted
- what the match score was
- what kind of output led to engagement

## Programmatic Product Feedback Loop

PostHog should not just be a dashboard. It should become a product-development feedback loop.

The loop:

```text
Generate output
Track which parts users inspect, copy, edit, download, or abandon
Score outputs based on behavior
Review patterns in useful vs ignored outputs
Improve prompts, templates, and UI
Measure whether engagement improves
```

## Result Quality Signals

After instrumentation exists, user behavior can become implicit feedback.

| Behavior | Product meaning |
|---|---|
| `optimization_section_expanded` | User inspected generated changes |
| `optimized_bullet_copied` | Strong positive signal that a generated bullet was useful |
| `resume_downloaded` | Strongest signal that the output became usable |
| `latex_editor_opened` | User moved from analysis into resume editing |
| `resume_edited` | Output was useful but needed correction |
| `new_run_started` soon after results | Could mean iteration, or dissatisfaction with first output |
| `results_viewed` with no interaction | Weak result, unclear UI, or low user intent |

## Possible Usefulness Score

A simple scoring model can be built later to evaluate each run.

Example:

```text
results_viewed = +1
optimization_section_expanded = +2
optimized_bullet_copied = +3
latex_editor_opened = +2
resume_edited = +1 or mixed signal
resume_downloaded = +5
new_run_started within 2 minutes = -2
viewed results but left with no interaction = -1
```

This would create a rough `result_usefulness_score` for each run.

## Database Layer to Consider Later

PostHog is useful for analytics, but Applican's database should eventually store structured result-quality interactions.

Possible table:

```sql
resume_output_interactions
```

Possible fields:

```text
id
user_id
run_id
event_type
section_id
section_kind
bullet_id
original_text
optimized_text
job_title
job_description_hash
match_score
created_at
```

Why this matters:

This turns product behavior into a dataset. Applican can identify which kinds of generated bullets are copied, edited, downloaded, ignored, or rerun.

## How This Improves Applican's Results

Once the result-engagement events exist, use them to improve output quality.

### If users view results but do not expand sections

Possible interpretation:

- Results page does not make the value obvious
- Users do not understand what changed
- UI hierarchy is weak

Product response:

- Improve result layout
- Make before/after changes more obvious
- Add clearer labels and calls to action
- Surface the highest-impact recommendations first

### If users expand sections but do not copy or download

Possible interpretation:

- Generated bullets are interesting but not usable
- Wording may be too generic
- Output may not be specific enough to the job description

Product response:

- Improve prompts
- Add stricter specificity requirements
- Reduce vague language
- Bias toward Action -> Tool -> Result structure
- Penalize generic phrases

### If users copy bullets but do not open the editor or download

Possible interpretation:

- Generated content is useful, but the export/editing flow has friction

Product response:

- Improve CTA placement
- Make `copy`, `apply`, `edit`, and `download` easier
- Reduce steps between results and usable resume output

### If users edit generated content heavily

Possible interpretation:

- Output is useful but needs correction
- Generated resume language may be too strong, too weak, too generic, or misaligned

Product response:

- Compare original generated text to edited text
- Identify recurring edits
- Update prompt/template rules based on the edits

### If users start another run immediately after viewing results

Possible interpretation:

- They are iterating intentionally
- Or the first result did not satisfy them

Product response:

- Compare this behavior with copy/download behavior
- If many users rerun without copying/downloading, improve first-pass output quality
- If users rerun after copying/downloading, that may indicate healthy repeated use

## Pre-User Testing Plan

Since there are not real users yet, use manual internal testing first.

Create 10 to 20 test runs across likely roles:

```text
Product Support Engineer
Technical Customer Success
Implementation Consultant
Product Operations
Data Analyst
Technical Support Specialist
Product Designer
UX/Product hybrid roles
```

For each generated result, manually score:

```text
Would I copy this bullet? yes/no
Is this bullet specific? 1-5
Is it believable? 1-5
Is it aligned to the job description? 1-5
Is it better than the original? 1-5
```

Use this to improve prompts before enough real user data exists.

## Near-Term PostHog Dashboard After Tomorrow

After result events are implemented, create a real result-engagement funnel:

```text
results_viewed -> optimization_section_expanded -> optimized_bullet_copied / resume_downloaded
```

Recommended name:

```text
Result Engagement Funnel
```

Purpose:

Measure whether users who reach results actually inspect and use the output.

## Main Product Quality Metric

After tomorrow, the primary quality metric should be:

```text
Of users who view results, what percentage copy, download, edit, or start another meaningful run?
```

This is more meaningful than raw signups, pageviews, or generations.

## Current Dashboard Status

The dashboard now has a clean v1 structure:

1. Core Activation Funnel
2. Generation Reliability Funnel
3. Generation Failure Events
4. Results Viewed
5. Time to First Result
6. Results Viewed by Referrer
7. Signup to Activation Funnel

This is enough for a v1 analytics foundation. The next step is not adding more dashboard cards. The next step is adding result-quality instrumentation so Applican can learn from generated-output behavior.
