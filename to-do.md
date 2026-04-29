# Applican Product To-Do

Assessment basis:
- `/` currently redirects to `/login` or `/app` in [applican/src/router.tsx](/Users/felixm/Desktop/applican/applican/src/router.tsx:54)
- the only public routes today are auth and recovery pages
- `Career Path` and `Resources` are not shipped product surfaces yet
- the editor exists, but PDF preview is explicitly unavailable

This file is intentionally explicit. The goal is to turn vague "needs polish" feedback into concrete launch work.

## 1. Public Website Surface

### Problem

Right now there is no true public website.

What exists today:
- `/` immediately redirects to `/login` or `/app`
- there is no landing page
- there is no pricing page
- there is no public explanation of what the product does
- there is no public demo, walkthrough, FAQ, or trust-building content
- there is no onboarding path before account creation

Why this matters:
- a new visitor has no chance to understand the product before being asked to log in or sign up
- paid conversion will be weak because there is no pricing context or value framing
- the app feels like an internal tool or private beta instead of a product
- traffic from social, search, referrals, or ads has nowhere appropriate to land

### To-Do

- Build a real `/` landing page instead of redirecting immediately.
- Keep `/app` as the authenticated product shell.
- Move the auth-first experience to explicit routes like `/login` and `/signup`, not the root.
- Add a public navigation with at minimum:
  - Product
  - Pricing
  - How it works
  - Login
  - Sign up
- Add a hero section that answers all of these in under 10 seconds:
  - what Applican does
  - who it is for
  - what output the user gets
  - why it is better than editing resumes manually
- Add a "How it works" section with the actual workflow:
  - upload resume
  - paste job description
  - get tailored analysis
  - generate tailored resume output
  - track applications
- Add a "What you get" section with product-specific value, not generic AI copy.
  - match analysis
  - bullet optimization
  - tailored resume artifact
  - application tracker
  - saved history
- Add a public pricing page.
  - explain free plan limits
  - explain pro plan value
  - explain refund/cancellation expectations clearly
- Add a FAQ page or FAQ section.
  - supported file types
  - how long generation takes
  - whether resumes are stored
  - what happens after upload
  - whether the result is editable
  - how billing works
- Add trust content.
  - privacy summary
  - data handling summary
  - support contact
  - terms/privacy links
- Add at least one real product preview.
  - screenshots
  - short visual flow
  - sample output

### Definition Of Done

- an unauthenticated visitor can understand the product without creating an account
- `/` is a marketing/product page, not a redirect
- pricing is publicly visible
- CTA paths are obvious and consistent
- the product no longer feels hidden behind auth

## 2. Pricing And Packaging Clarity

### Problem

The app has billing and plan logic, but the packaging is still mostly internal. The code knows about free vs pro, but the product messaging around that split is not mature enough.

Why this matters:
- users do not upgrade just because a modal blocks them
- pricing needs context, feature comparison, and perceived value
- upgrade friction is high if the first real explanation happens after the user hits a paywall

### To-Do

- Document exactly what free includes.
- Document exactly what pro includes.
- Make feature gating understandable before the user hits a locked view.
- Add a feature comparison table.
- Add upgrade prompts in places where intent is strongest:
  - after first successful generation
  - when history becomes valuable
  - when locked views are selected
- Rewrite upgrade modal copy to be product-specific.
- Add pricing copy that explains outcomes, not only access.
- Add billing lifecycle messaging:
  - trial or no trial
  - monthly or annual
  - cancellation timing
  - what happens after downgrade

### Definition Of Done

- a visitor can explain the difference between free and pro without using the app
- locked views feel like upgrade prompts, not arbitrary blocks
- pricing supports conversion rather than just access control

## 3. First-Time User Onboarding

### Problem

A new user can sign up and reach the app, but there is not yet a strong first-run product experience that guides them from zero to first success.

Why this matters:
- first session drop-off is usually the biggest leak in an MVP
- users need momentum, not just available controls
- the current product assumes the user already understands the workflow

### To-Do

- Add a first-run onboarding state after signup.
- Show a short guided checklist:
  - upload your resume
  - paste a job description
  - generate your first tailored result
  - review optimized bullets
  - open the editor/history if relevant
- Add empty-state copy across the app that explains what to do next.
- Show a clear "start here" path on the initial authenticated screen.
- Add microcopy around file upload and job description quality.
- Add example job description input or a sample button for testing the flow.
- Add a success handoff after first result:
  - what to review
  - what to download
  - where to find history
  - how to track the application

### Definition Of Done

- a first-time user can reach a successful result without guessing
- the first session is guided, not exploratory
- empty states feel intentional and helpful

## 4. Resume Studio UX Hardening

### Problem

The core flow exists, but it still needs product-level hardening around waiting, failure, recovery, and clarity.

Why this matters:
- this is the product's main value loop
- any confusion here directly hurts retention and conversion
- long-running AI flows need better user communication than standard CRUD screens

### To-Do

- Make every stage of the generation flow visibly distinct:
  - uploading
  - extraction
  - queued for generation
  - generating analysis
  - completed
  - failed
- Improve progress copy so it reflects real backend states.
- Add explicit retry guidance for retryable failures.
- Preserve job description and uploaded file references reliably across refreshes and navigation.
- Add clearer messaging for provider delays and queue delays.
- Add a "what happens next" message while waiting.
- Add better post-success structure:
  - summary of match
  - key strengths
  - key gaps
  - next action CTA
- Add better failure segmentation:
  - invalid input
  - extraction failure
  - queue delay
  - generation provider issue
  - unknown internal failure

### Definition Of Done

- users always understand what stage their run is in
- failures are actionable where possible
- the resume studio feels dependable, not opaque

## 5. Editor Completeness

### Problem

The editor is present, but it is not yet a fully convincing product feature. The UI explicitly says PDF preview is unavailable.

Why this matters:
- an editor without preview feels incomplete
- users expect resume review to be visual, not only raw LaTeX
- this makes the feature feel closer to a dev tool than a polished user feature

### To-Do

- Decide the actual intended editor product:
  - internal power-user tool
  - pro-only advanced feature
  - mainstream user-facing editing workflow
- Add PDF preview if this is meant to be a real product surface.
- If live preview is too expensive, add one of:
  - server-rendered preview refresh
  - last compiled PDF preview
  - side-by-side downloadable rendered snapshot
- Add clearer editing affordances.
- Explain what editing changes affect.
- Add save/version behavior if edits are meant to persist.
- Add "recompile" or equivalent user action if preview/rendering depends on compilation.

### Definition Of Done

- the editor either becomes a complete user feature or is intentionally scoped down
- users can understand the purpose of the editor immediately
- preview/edit/download behavior is coherent

## 6. Career Path And Resources Scope Decision

### Problem

These views are visible in the app navigation, but they are not real product surfaces yet.

Why this matters:
- visible unfinished features make the product feel less trustworthy
- users read nav items as promises
- "coming soon" is acceptable temporarily, but not as a stable product state

### To-Do

- Decide whether `Career Path` and `Resources` are:
  - near-term launch features
  - post-launch roadmap items
  - concepts that should be removed for now
- If not shipping soon, remove them from primary navigation.
- If keeping them visible, add a proper waitlist or notification capture.
- Replace placeholder surfaces with pages that explain:
  - what the feature will do
  - who it is for
  - why it matters
  - when it is expected

### Definition Of Done

- navigation only contains features the product can defend
- "coming soon" is used intentionally, not as a filler state

## 7. Application Tracker Productization

### Problem

The application tracker is more than a stub, but it needs stronger product framing so it feels connected to the main workflow rather than adjacent to it.

Why this matters:
- this can be a retention feature
- it helps turn one-off resume generation into an ongoing product habit
- it can differentiate Applican from simpler resume tools

### To-Do

- Make the connection between generated resumes and tracked applications more obvious.
- Clarify the lifecycle:
  - generated resume
  - ready to apply
  - applied
  - interview stages
  - rejected or offer
- Improve the empty state.
- Add guidance for what the tracker is for.
- Add stronger actions after generation:
  - save to tracker
  - mark as ready to apply
  - attach generated artifact
- Review whether the tracker needs notes, links, or job posting references.
- Review whether the tracker needs date reminders or follow-up reminders.

### Definition Of Done

- the tracker feels like part of the core product, not a side panel
- users understand why it exists and when to use it

## 8. History And Retrieval UX

### Problem

History exists, but it is still mostly a functional surface. It should become a strong "return value" feature.

Why this matters:
- history is part of retention
- users need confidence that their work is saved and recoverable
- a good history surface reduces fear around long-running generation

### To-Do

- Make history easier to scan.
- Add filtering or grouping if the list becomes large.
- Add clearer labels:
  - company
  - role
  - run date
  - output type
  - generation status
- Add re-open or continue workflows where appropriate.
- Add stronger empty state and loading state copy.
- Confirm whether users can reliably recover prior outputs after refresh, logout, and re-login.

### Definition Of Done

- users trust that previous work is saved
- history helps users return to old outputs quickly

## 9. Product Copy And Positioning

### Problem

The product likely still relies too much on implementation-shaped language and not enough on outcome-shaped language.

Why this matters:
- users buy outcomes, not architecture
- good copy reduces confusion without adding engineering work
- weak copy can make a solid MVP feel less complete than it is

### To-Do

- Rewrite key product copy around outcomes:
  - faster job applications
  - better tailoring quality
  - less manual resume editing
  - better application organization
- Review all button labels and headings for clarity.
- Replace generic phrases with product-specific ones.
- Standardize tone across:
  - landing page
  - auth pages
  - upgrade modal
  - loading states
  - error states
  - empty states

### Definition Of Done

- the product sounds like a real product, not only an app under construction
- copy consistently explains value and next actions

## 10. Trust, Support, And Operational Product Layer

### Problem

The backend may be capable enough for an MVP, but the product still needs visible trust and support surfaces.

Why this matters:
- users upload resumes and possibly personal information
- billing and AI generation create support burden
- people need to know what happens when something breaks

### To-Do

- Add privacy policy and terms pages.
- Add visible support contact or support flow.
- Add account/help entry points inside the app.
- Add user-facing outage and degraded-service messaging.
- Add billing support guidance.
- Add clearer data retention language.
- Add safer messaging around uploaded resume handling.

### Definition Of Done

- the product has enough trust surface for real users to take it seriously
- users know where to go when billing or generation fails

## 11. Launch-Critical QA And Repo Health

### Problem

The product surface is meaningful, but launch confidence is reduced if the repo is not in a clean passing state.

Current notable issues from local verification:
- `npm test` is not fully green
- `useCreateResumeRun` tests are out of sync with the queue-based flow
- Playwright specs are being picked up incorrectly by Vitest
- e2e could not be validated in this sandbox because the local web server port could not bind

Why this matters:
- launch is not just "features exist"
- broken or stale tests usually indicate refactor drift
- drift between product behavior and test expectations slows future changes

### To-Do

- Separate Vitest and Playwright file matching cleanly.
- Update generation-flow tests to reflect queue-based behavior.
- Make the default test commands reliable and unsurprising.
- Add a simple pre-launch validation checklist:
  - auth flow
  - signup flow
  - resume upload
  - generation success
  - retryable generation failure
  - billing checkout
  - billing portal
  - history retrieval
  - application tracker update

### Definition Of Done

- core automated checks pass consistently
- product-critical flows are manually validated before launch

## 12. Suggested Execution Order

If the goal is public launch soon, do the work in this order:

1. Build the public website surface.
2. Clarify pricing and packaging.
3. Improve first-run onboarding.
4. Harden Resume Studio states and failure UX.
5. Fix repo/test health for the current architecture.
6. Decide whether `Career Path` and `Resources` ship, hide, or move to roadmap.
7. Upgrade editor completeness only if it is meant to be a real selling feature for launch.
8. Add trust/legal/support surfaces before accepting serious traffic.

## 13. Short Version

The single biggest product gap is not the backend pipeline. It is that the product still behaves like an app you already know you want, rather than a product that can explain itself, sell itself, and guide a new user from first visit to first success.

That starts with replacing the current root redirect with a real public product surface.
