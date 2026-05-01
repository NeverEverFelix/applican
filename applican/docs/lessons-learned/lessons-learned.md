# Lessons Learned

## 1. UI Process, Styling, Views, Viewports, and Breakpoints

This section documents how the UI in this repo actually evolved, what was missing early on, and what would have been the more professional and production-aligned process.

### What I Did First In This Repo

The UI started by defining routes, pages, and feature screens directly, then styling those screens locally with CSS modules.

The early shape of the app was roughly:

- auth-first page creation
  - `274f110 initial log in + signup page`
  - `1764492 home page started`
- prototype-driven shell and feature growth
  - `bc9a644 protoype v1 complete`
  - `f3dd3ff Auth/Account Recovery done`
  - `2c7d2f5 application tracker additions`
  - `fc3bcef resume preview`

In practice, that meant:

- routes were created before a formal view system existed
- pages and feature panels were added as the product grew
- styling was done locally at the page/component level with CSS modules
- feature-specific UI behavior was added inline as needed
- viewport behavior and breakpoint rules were added late
- device-specific product rules were added even later

The repo history supports that progression:

- `src/pages/LoginPage.tsx`, `SignupPage.tsx`, and related auth pages came first
- `src/pages/HomePage.tsx` became the shell where multiple product areas lived
- `src/features/applicationTracker/ui/applicationTrackerContent.tsx` became the main view switch
- `src/features/applicationTracker/ui/applicationTrack.module.css` accumulated most of the complex product UI layout
- `src/features/applicationTracker/ui/views/ResumeStudioView.tsx` and `EditorView.tsx` were layered in as deeper product experiences
- `src/components/profile/Profile.tsx` and related account screens were added after the main shell existed

### What UI / Styling Approach That Produced

The app now uses a mixed frontend UI stack:

- primary styling approach: CSS Modules
- motion and transitions: GSAP, some Framer Motion utilities
- dropdown/menu primitives: Radix UI
- modal usage: MUI
- editor surface: Monaco

That is not inherently wrong, but it means the UI system was assembled incrementally rather than declared up front.

The result was:

- strong local momentum early
- fast prototyping of screens and interactions
- real product surfaces shipped quickly
- but no formal view model at the beginning
- no viewport matrix at the beginning
- no shared breakpoint foundation at the beginning
- no explicit rule for when to use raw CSS modules versus UI primitives

### What Was Missing Up Front

The main things that were not defined early enough were:

#### View Taxonomy

The product had views, but they were not initially treated as a first-class system.

Examples:

- `Resume Studio`
- `Application Tracker`
- `Profile`
- `History`
- `Editor`
- `Career Path`
- `Resources`

These existed in the product, but the formal view model and policy came later.

#### Device / Viewport Matrix

There was no initial statement like:

- desktop gets all supported production views
- tablet gets a reduced set
- mobile gets a reduced set
- some views are disabled globally

Because this was missing, responsive behavior began as layout adaptation instead of product behavior definition.

#### Breakpoint System

Breakpoints existed in CSS, but not as a declared system.

The repo already had patterns around:

- `1279px`
- `767px`

But those were used as scattered media-query thresholds before they were turned into shared responsive logic.

#### Layout Primitives

There was no early shared definition of:

- shell layout
- content container widths
- section spacing
- form stack widths
- scroll region behavior
- desktop-only versus cross-device surfaces

Because of that, fixed widths and absolute positioning appeared in several places and had to be normalized later.

#### Framework Decision Rules

The repo uses multiple UI tools, but the decision rules were not documented first.

Examples:

- CSS Modules for most styling
- Radix for dropdowns
- MUI for modal behavior
- Monaco for editor
- GSAP for motion-heavy interactions

A more mature process would have stated what the primary UI layer was and when exceptions were allowed.

### What This Caused

Starting with routes, screens, and local CSS first created a few predictable problems:

#### 1. View Logic Came After UI Implementation

The product had views before it had a formal view policy.

That made later device-specific rules harder, because support rules had to be retrofitted into:

- selection behavior
- nav behavior
- rendered content behavior

#### 2. Responsive Work Started As Layout Repair

Instead of beginning with a viewport matrix, responsive work began as:

- fixing fixed widths
- removing absolute positioning
- reducing rigid spacing
- managing scroll fallback behavior

That is a repair path, not an ideal path.

#### 3. Styling Became Locally Correct But Globally Uneven

Each page or feature could look correct on its own, but the system lacked:

- shared breakpoint semantics
- shared layout rules
- shared availability states
- shared product behavior rules by device

#### 4. Unsupported Features Were Initially Just “There”

Without a policy system, unavailable views could still appear like normal product surfaces until explicit rules were added later.

### What I Should Have Done First

The more professional and production-aligned process would have been:

#### Step 1. Define The Product Surface

Before building screens, define:

- what the core views are
- what each view is responsible for
- which views are production-ready
- which views are experimental
- which views are coming soon

For this app, that would have meant declaring the studio view set early.

#### Step 2. Define The Device Matrix

Before responsive styling, define product behavior by device.

Example:

- desktop: `Resume Studio`, `Application Tracker`, `Profile`, `History`, `Billing`, `Editor`
- tablet: `Resume Studio`, `Application Tracker`, `Profile`, `History`, `Billing`
- mobile: `Resume Studio`, `Application Tracker`, `Profile`, `History`, `Billing`
- disabled everywhere: `Career Path`, `Resources`

This is the kind of decision that should exist before layout work begins.

#### Step 3. Define Breakpoints As Shared System Inputs

Before writing scattered media queries, define:

- breakpoint names
- exact width thresholds
- which thresholds drive layout only
- which thresholds drive product behavior

In this repo, that became:

- mobile max: `767`
- tablet max: `1279`

But that should have been introduced before the CSS spread across files.

#### Step 4. Define Layout Primitives

Before styling each screen independently, define:

- shell columns
- form widths
- content max widths
- spacing scale
- card spacing
- scroll behavior
- fixed versus fluid containers

That would have prevented some of the later cleanup in `Profile`, `Resume Studio`, `Editor`, and `Application Tracker`.

#### Step 5. Choose The Primary UI Layer

Define what the default approach is:

- CSS Modules as default styling
- Radix for primitives where accessibility/behavior matter
- MUI only where specifically justified
- motion libraries used intentionally, not opportunistically

That does not mean using fewer tools automatically. It means using them deliberately.

#### Step 6. Add Tests Around The Product Rules Early

The first useful tests in this area would have been:

- nav availability by device
- fallback behavior for unsupported views
- default view normalization when stored state is incompatible with the current device

That would have made later responsive/product behavior changes safer.

### What I Did Next To Make It More Professional And Production-Aligned

After the initial UI had already grown, the cleanup path became:

#### 1. Normalize Rigid Layouts

We started removing the highest-risk layout constraints first:

- absolute-positioned profile layout
- fixed-width Resume Studio blocks
- rigid Editor sizing
- brittle tracker spacing

This was the necessary first repair step before device-specific behavior could be handled cleanly.

#### 2. Introduce Shared Responsive Foundations

We then added a shared responsive layer:

- `src/lib/responsive.ts`
- `src/hooks/useViewport.ts`

This created:

- shared breakpoint constants
- shared media-query semantics
- shared viewport buckets

#### 3. Introduce A Centralized View Policy

We added:

- `src/features/applicationTracker/ui/studioViewPolicy.ts`

This formalized:

- which views are supported on which devices
- fallback targets
- unavailable titles
- unavailable body copy
- nav availability labels
- fallback CTA labels

This is the point where views became a real product system instead of just UI branches.

#### 4. Make Nav And Render Follow The Same Policy

We then updated:

- `HomePage`
- `ApplicationTrackerContent`

So that both selection behavior and rendered behavior follow the same policy rules.

That is much closer to production discipline than handling support rules with scattered conditionals.

#### 5. Add Focused Tests Around Policy Behavior

We added focused tests for:

- responsive helper behavior
- view policy behavior
- `ApplicationTrackerContent` fallback behavior
- `HomePage` selection and disabled-nav behavior

This is an important shift from “ship the screen” to “ship the screen plus the product rules.”

### The Professional Lesson

The main lesson is not that building quickly was wrong. The lesson is that the first pass optimized for visible progress, while the later pass had to retrofit product structure.

The production-aligned order would have been:

1. define views
2. define device matrix
3. define breakpoint system
4. define layout primitives
5. define framework rules
6. build screens
7. test policy and availability behavior

What actually happened was closer to:

1. build routes and screens
2. style pages locally
3. grow features into the shell
4. add richer UI behaviors and screens
5. discover responsive/product availability problems
6. retrofit breakpoints, view policy, and tests

That path is common in real projects. The important thing is recognizing it clearly and documenting the correction.

### Working Rule Going Forward

For future UI work in this repo:

- no new cross-device feature should be added without first deciding its device matrix
- no new major view should be added without policy metadata
- no new “coming soon” or “desktop only” state should be hardcoded locally if it belongs to product policy
- no major responsive work should begin without deciding whether the change is layout-only or product-behavior-specific

That is the process shift from prototype-driven UI growth to production-aligned frontend architecture.
