# Workflow Save Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent workflow saves from sending shipment-owned fields to the deployed `kols` table.

**Architecture:** Keep `shipments` as the persisted logistics source and `kols.status` as the only workflow-owned KOL field. Enforce this both at the central KOL service whitelist and at the two workflow UI call sites.

**Tech Stack:** React 18, TypeScript, Supabase JS, Vitest

---

### Task 1: Lock The KOL Persistence Boundary

**Files:**
- Modify: `src/services/kolService.ts`
- Test: `src/services/kolService.test.ts`

- [ ] **Step 1: Write the failing test**

Import `sanitizeKOLUpdates` and assert that a payload containing `status` plus the four legacy shipment fields returns exactly `{ status: '运输中' }`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/services/kolService.test.ts`

Expected: FAIL because `sanitizeKOLUpdates` is not exported.

- [ ] **Step 3: Implement the persistence whitelist**

Export `sanitizeKOLUpdates`, allow only current database columns, and call it from `updateKOL`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- src/services/kolService.test.ts`

Expected: all tests in the file pass.

### Task 2: Make Workflow Call Sites Status-Only

**Files:**
- Modify: `src/components/KolDrawer.tsx`
- Modify: `src/components/ShipmentBoard.tsx`

- [ ] **Step 1: Replace drawer synchronization**

Change the drawer helper to accept only a status and update `{ status }`. Derive that status from the saved or remaining shipment at each call site.

- [ ] **Step 2: Replace board synchronization**

Change the board helper to accept `kolId` and `status`, then update `{ status }` only.

- [ ] **Step 3: Check for stale persisted writes**

Run: `rg -n "onUpdate\([^\n]*sample_product|sample_product: shipment|sample_date: shipment|tracking_number: shipment|shipping_details: shipment" src/components src/services`

Expected: no workflow persistence payload contains those fields.

### Task 3: Verify The Repair Batch

**Files:**
- No additional production files

- [ ] **Step 1: Run all tests**

Run: `npm.cmd test`

Expected: all test files pass with zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm.cmd run build`

Expected: TypeScript and Vite build exit successfully.

- [ ] **Step 3: Review the final diff**

Run: `git diff --check` and `git diff -- src/services/kolService.ts src/services/kolService.test.ts src/components/KolDrawer.tsx src/components/ShipmentBoard.tsx`

Expected: no whitespace errors and only the scoped save repair is present.
