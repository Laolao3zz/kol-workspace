# KOL Product Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct historical product names per KOL, group casing variants in opportunities, protect referenced products from deletion, and remove duplicate progress metrics.

**Architecture:** Centralize product comparison in `productMatching`, keep correction selection/counting pure in `productCorrection`, and execute product-only writes through a conditional correction service that rechecks id, KOL, and source product. The KOL drawer owns the correction interaction and refreshes all affected data; the product library owns the zero-reference deletion guard.

**Tech Stack:** React 18, TypeScript, Vitest, Supabase, Tailwind CSS

---

### Task 1: Normalize opportunity matching

**Files:**
- Modify: `src/utils/productMatching.ts`
- Modify: `src/utils/workspaceViews.ts`
- Test: `src/utils/workspaceViews.test.ts`

- [x] Add a failing test showing a `k1` record under managed product `K1`.
- [x] Run the focused test and confirm the opportunity status is wrong before the fix.
- [x] Export and reuse one normalized product comparator in every opportunity lookup.
- [x] Run the focused tests and confirm they pass.

### Task 2: Define correction and deletion rules

**Files:**
- Create: `src/utils/productCorrection.ts`
- Create: `src/utils/productCorrection.test.ts`

- [x] Add failing tests for exact source spelling, current-KOL scoping, and reference counts.
- [x] Run the focused tests and confirm the module is missing.
- [x] Implement pure correction planning and exact reference counting.
- [x] Run the focused tests and confirm they pass.

### Task 3: Execute and expose product correction

**Files:**
- Create: `src/services/productCorrectionService.ts`
- Create: `src/services/productCorrectionService.test.ts`
- Create: `src/components/CorrectProductModal.tsx`
- Modify: `src/components/KolDrawer.tsx`

- [x] Add a failing service test that verifies every planned record is updated and failures are reported after all attempts.
- [x] Implement the idempotent all-settled executor using conditional product-only updates.
- [x] Add the KOL drawer action, preview counts, confirmation, refresh, and error feedback.
- [x] Run focused service and utility tests.

### Task 4: Protect product deletion and simplify the board

**Files:**
- Modify: `src/components/ProductOpportunityView.tsx`
- Modify: `src/components/ShipmentBoard.tsx`

- [x] Add zero-reference delete handling to the product library and reject referenced products.
- [x] Add the transactional `delete_product_if_unreferenced` RPC to the Supabase schema and patch.
- [x] Remove the duplicate top metric row and place overdue risk in the content column header.
- [x] Run TypeScript build to verify component contracts.

### Task 5: Verify and commit

**Files:**
- Review all changed files.

- [x] Run `npm test` and confirm zero failures.
- [x] Run `npm run build` and confirm exit code 0.
- [x] Run `git diff --check` and inspect `git diff` for scope.
- [x] Complete an independent code review and address important findings.
- [x] Create one local commit without pushing.
