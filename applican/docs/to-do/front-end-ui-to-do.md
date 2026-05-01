# Front-End / UI To-Do

## Desktop UI Hardening

The desktop UI is in a much better place structurally, but it should not be treated as fully production-hardened yet.

### Current Assessment

- desktop shell and view switching are now coherent
- unsupported and coming-soon states are policy-driven instead of ad hoc
- editor/device access rules are centralized
- targeted test coverage exists for policy and nav behavior

This means the desktop UI is reasonably close, but not finished.

## Remaining Work

### 1. Final Layout And Interaction Consistency Pass

Do one deliberate desktop polish pass across all major views:

- check spacing consistency across views
- check hover, focus, disabled, and active states
- check empty, loading, and error states for consistency
- check shell-level transitions and view switching behavior

### 2. Reduce Risk Around Large Shared UI Files

`src/features/applicationTracker/ui/applicationTrack.module.css` still carries a large amount of UI responsibility.

Action items:

- audit sections of the file for future extraction opportunities
- document which parts belong to Resume Studio, Editor, Tracker, and shared shell behavior
- avoid continuing to grow the file without structure

### 3. Improve Desktop UI Test Confidence

Current coverage is helpful but selective.

Add or strengthen:

- page-level interaction coverage for key desktop views
- critical desktop happy-path flows
- policy-aware behavior tests where appropriate
- optional visual regression coverage for the most important screens if UI fidelity becomes a priority

### 4. Resolve Or Document Existing Unrelated Test / Build Issues

The frontend work here exposed unrelated repo issues during build/test runs.

Action items:

- resolve existing unrelated TypeScript/test failures where possible
- if not resolved immediately, document them clearly so UI readiness is not overstated

## Production Readiness Checkpoint

The clean next checkpoint for desktop UI is:

1. smoke-test all desktop views manually
2. tighten obvious spacing or state inconsistencies
3. verify disabled / coming-soon / desktop-only states are visually consistent
4. clear or explicitly document unrelated build/test issues

## Practical Conclusion

- desktop UI architecture: reasonably ready
- desktop UI polish: close, but still needs a final pass
- overall frontend production readiness: not fully there until broader test/build cleanliness improves
