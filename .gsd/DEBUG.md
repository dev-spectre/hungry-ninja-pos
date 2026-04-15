# Debug Session: User Creation RBAC Fix

## Symptom
Error when adding a user to a different branch. Occurred specifically when the active administrator had multiple roles/permissions.

**When:** During `POST /api/users` or `POST /api/branch`.
**Expected:** Successful resource creation.
**Actual:** 403 Forbidden.

## Hypotheses

| # | Hypothesis | Likelihood | Status |
|---|------------|------------|--------|
| 1 | Syntax error in middleware (typo 'e') | 100% | CONFIRMED & FIXED |
| 2 | Strict RBAC equality checks failing multi-roles | 100% | CONFIRMED & FIXED |

## Resolution

**Root Cause:** The API routes used `=== "SUPER_ADMIN"`. Users with multiple roles (e.g., `"SUPER_ADMIN,BILLING"`) failed this strict check even if they held the necessary authority. Also a syntax error in `middleware.ts` was breaking the request pipeline.
**Fix:** Refactored all RBAC checks to use `.includes("ROLE")` and fixed the middleware typo.
**Verified:** Logic audit confirmed all strict equality checks for roles are removed.
