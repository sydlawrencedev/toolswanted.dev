---
name: verification-before-completion
description: >
  Enforces evidence before claims - running verification commands before stating
  work is complete. Universal skill for all agents. Triggers: done, complete,
  finished, verified, ready, tested, checked, works, all set, ship it
---

# Verification Before Completion Skill

This skill enforces evidence before claims. Always run verification commands before stating work is complete.

## Core Principle

**"Seems right" is not done. Prove it works.**

Before marking any work as complete, you must provide evidence that:
1. The code does what it was asked to do
2. The code doesn't break existing functionality
3. The code passes lint/typecheck/tests (when applicable)

---

## Verification Checklist

### For Code Changes

- [ ] **Lint passes:** `npm run lint` or equivalent
- [ ] **Typecheck passes:** `npm run typecheck` or `tsc --noEmit`
- [ ] **Tests pass:** `npm run test` or the relevant test command
- [ ] **Build succeeds:** `npm run build` or the relevant build command
- [ ] **Manual verification:** If no tests exist, verify manually with a deterministic repro

### For Bug Fixes

- [ ] Reproduction case no longer fails
- [ ] Existing tests still pass
- [ ] New regression test added (when applicable)

### For New Features

- [ ] Feature works as specified
- [ ] Edge cases handled
- [ ] Existing functionality unaffected

---

## Verification Commands Reference

Run the appropriate commands based on what exists in the project:

```bash
# Linting
npm run lint
# or
pnpm lint
# or
yarn lint

# Type checking
npm run typecheck
# or
npx tsc --noEmit

# Tests
npm run test
npm run test:watch  # for TDD mode
npm run test:coverage  # with coverage

# Build
npm run build

# Combined (if available)
npm run verify  # or ci or check
```

---

## What to Do When Verification Fails

1. **Do not mark the issue as done.**
2. **Fix the failure first** before completing the work.
3. **If blocked by an unrelated issue**, document what failed and why you cannot proceed.
4. **If you need user help**, ask one targeted question with a recommended default.

---

## Verification Story Template

When completing work, include in your comment:

```
## Verification

- [ ] Lint: passed
- [ ] Typecheck: passed  
- [ ] Tests: N passed
- [ ] Manual repro: [what you tested and the result]
```

---

## Key Rules

- **Never say "all done" without evidence.**
- **Never mark done if tests are skipped or not run.**
- **If no test exists, that is a gap** - note it and either add a basic test or flag it for follow-up.
- **Build failures are not optional to fix.**
- **"Works on my machine" is not verification.** Show evidence it works.
