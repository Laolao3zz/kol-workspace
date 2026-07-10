# Product Alias Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide archived product aliases from normal operations and provide a safe, dry-run-first command for one-time product-name correction.

**Architecture:** Keep routine product CRUD in the React application and move cross-table corrections to a Node script. A pure planning helper normalizes explicit aliases and reports affected rows; the command applies idempotent updates and verifies zero residual references before deleting duplicate product records.

**Tech Stack:** React 18, TypeScript, Supabase JS, Node.js, Vitest

---

### Task 1: Filter Archived Products

**Files:**
- Modify: `src/utils/productMatching.ts`
- Test: `src/utils/productMatching.test.ts`
- Modify: `src/components/ProductOpportunityView.tsx`

- [ ] **Step 1: Write the failing utility test**

Add an archived product to `mergeOpportunityProducts` input and expect only active and paused product names.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- src/utils/productMatching.test.ts`

Expected: the archived product is still returned.

- [ ] **Step 3: Implement archived filtering**

Skip `Product` objects whose status is `归档`. Use the same filtered list for the product-library count and cards.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd test -- src/utils/productMatching.test.ts`

Expected: all tests in the file pass.

### Task 2: Build The Alias Repair Planner

**Files:**
- Create: `scripts/product-alias-repair-utils.mjs`
- Create: `scripts/product-alias-repair-utils.test.mjs`

- [ ] **Step 1: Write failing planner tests**

Cover whitespace/case normalization, reference IDs grouped by table, a missing canonical product error, and `safeToDeleteSource` only when the residual reference count is zero.

- [ ] **Step 2: Verify RED**

Run: `npm.cmd test -- scripts/product-alias-repair-utils.test.mjs`

Expected: FAIL because the planner module does not exist.

- [ ] **Step 3: Implement the pure planner**

Export `normalizeProductName` and `buildProductAliasRepairPlan`. Return mapping-level source product IDs, target product ID, reference IDs, counts, errors, and the safe-delete decision without performing I/O.

- [ ] **Step 4: Verify GREEN**

Run: `npm.cmd test -- scripts/product-alias-repair-utils.test.mjs`

Expected: all planner tests pass.

### Task 3: Add The Dry-Run-First Repair Command

**Files:**
- Create: `scripts/repair-product-aliases.mjs`
- Modify: `package.json`

- [ ] **Step 1: Implement scanning and reporting**

Parse `.env.local` directly, require `SUPABASE_SERVICE_ROLE_KEY`, fetch all rows in stable `id` order from `products`, `invitations`, `shipments`, and `collaborations`, build a plan for `youyeetoo x1 -> X1`, and print aggregate JSON plus the sanitized project target. Exit without writes unless `--apply` is present.

- [ ] **Step 2: Implement restartable apply behavior**

Update matching workflow rows by ID to the exact stored canonical name, rescan, require zero residual references, then delete archived duplicate source product IDs. Abort a mapping with planner errors. Require `--project-ref <ref>` to match the project printed by dry-run before apply begins.

- [ ] **Step 3: Add package scripts**

Add `repair:product-aliases` for dry-run and `repair:product-aliases:apply` for explicit mutation.

- [ ] **Step 4: Verify the missing-config error path**

Run: `npm.cmd run repair:product-aliases`

Expected in this workspace: non-zero exit with a clear missing `.env.local` message and no writes.

### Task 4: Remove The Unsafe Merge Workflow

**Files:**
- Modify: `src/components/ProductOpportunityView.tsx`
- Modify: `src/services/productService.ts`
- Modify: `src/services/productService.test.ts`
- Modify: `src/services/demoDatabase.ts`

- [ ] **Step 1: Remove merge UI state and controls**

Delete the merge import, state, handlers, selection panel, and per-product merge buttons.

- [ ] **Step 2: Remove browser-side merge service code**

Delete `mergeProducts`, its merge-only helpers and types, the demo database method, and the old demo merge integration test.

- [ ] **Step 3: Search for stale merge behavior**

Run: `rg -n "mergeProducts|ProductMerge|sample_product: target|合并产品|确认合并" src`

Expected: no matches.

### Task 5: Verify The Batch

**Files:**
- No additional production files

- [ ] **Step 1: Run all tests**

Run: `npm.cmd test`

Expected: zero failed test files and zero failed tests.

- [ ] **Step 2: Run the production build**

Run: `npm.cmd run build`

Expected: TypeScript and Vite exit successfully.

- [ ] **Step 3: Review final changes**

Run: `git diff --check`, `git status --short`, and a scoped `git diff`.

Expected: no whitespace errors and only product cleanup files plus these design documents.
