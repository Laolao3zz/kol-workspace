# Workflow Integrity Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent duplicate auto-shipments, replace shipment markers in user notes with stable relation IDs, and make KOL homepage links open safely.

**Architecture:** Add two nullable relation IDs with partial unique indexes, then move workflow identity into pure helpers and service payloads. Keep legacy marker parsing only as a compatibility read path while all user-facing notes are sanitized.

**Tech Stack:** React 18, TypeScript, Vitest, Supabase/PostgreSQL, Vite

---

### Task 1: Invitation Transition Semantics

**Files:**
- Modify: `src/utils/invitationWorkflow.test.ts`
- Modify: `src/utils/invitationWorkflow.ts`

- [ ] **Step 1: Write failing transition tests**

Add tests proving a new approved invitation and a not-approved-to-approved transition return `true`, while an approved metadata-only edit returns `false`.

```ts
expect(shouldCreateShipmentForInvitation(null, approved)).toBe(true)
expect(shouldCreateShipmentForInvitation(pending, approved)).toBe(true)
expect(shouldCreateShipmentForInvitation(approved, { ...approved, notes: 'changed' })).toBe(false)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/utils/invitationWorkflow.test.ts`

Expected: FAIL because `shouldCreateShipmentForInvitation` is not exported.

- [ ] **Step 3: Implement the minimal transition helper**

Add `shouldCreateShipmentForInvitation(previous, next)` using the existing approval predicate. Relation-aware stale cleanup remains isolated in Task 2.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- src/utils/invitationWorkflow.test.ts`

Expected: PASS.

### Task 2: Invitation-To-Shipment Relation

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/KolDrawer.tsx`
- Modify: `src/services/shipmentService.ts`
- Test: `src/utils/invitationWorkflow.test.ts`

- [ ] **Step 1: Add a failing payload assertion**

Extend the workflow test fixtures with `source_invitation_id` and assert linked rows are retained only while their exact source invitation remains approved.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/utils/invitationWorkflow.test.ts`

Expected: FAIL because the linked cleanup behavior is absent.

- [ ] **Step 3: Implement relation-aware orchestration**

Add `source_invitation_id?: string | null` to `Shipment`. Pass the original invitation into workflow synchronization, call automatic creation only for an approval transition, and include `source_invitation_id: invitation.id` in the created shipment.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm.cmd test -- src/utils/invitationWorkflow.test.ts`

Expected: PASS.

### Task 3: Shipment-To-Collaboration Relation And Clean Notes

**Files:**
- Modify: `src/types.ts`
- Modify: `src/utils/collaborationArchive.test.ts`
- Modify: `src/utils/collaborationArchive.ts`
- Modify: `src/services/collaborationService.ts`
- Modify: `src/components/ShipmentBoard.tsx`
- Modify: `src/components/ArchiveCollaborationModal.tsx`
- Modify: `src/components/KolDrawer.tsx`
- Modify: `src/components/CollaborationHistoryView.tsx`

- [ ] **Step 1: Replace marker-exposure tests with failing relation tests**

Assert completion payloads contain `shipment_id`, notes contain no `[shipment:...]`, matching prefers exact `shipment_id`, same-product history without a relation is not reused, and `stripShipmentHistoryMarkers` removes one or multiple legacy markers.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/utils/collaborationArchive.test.ts`

Expected: FAIL because the payload still stores markers and falls back to product-only matching.

- [ ] **Step 3: Implement relation matching and sanitization**

Add `shipment_id?: string | null` to `Collaboration`, create clean completion payloads, match by `shipment_id` then legacy marker only, and sanitize notes in the archive form and all history displays.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- src/utils/collaborationArchive.test.ts`

Expected: PASS.

### Task 4: Idempotent SQL Migration

**Files:**
- Modify: `supabase-schema.sql`
- Create: `supabase-workflow-links.sql`

- [ ] **Step 1: Update canonical table definitions**

Add nullable `source_invitation_id` and `shipment_id` columns to their canonical table definitions.

- [ ] **Step 2: Add idempotent migration statements**

The standalone SQL must add columns, foreign keys, partial unique indexes, backfill valid legacy collaboration markers, and strip markers from notes. It must not change RLS policies or delete business rows.

- [ ] **Step 3: Inspect the SQL for destructive statements**

Run: `rg -n "DROP|TRUNCATE|DELETE FROM|CREATE POLICY|GRANT|REVOKE" supabase-workflow-links.sql`

Expected: no output.

### Task 5: Safe Homepage Navigation

**Files:**
- Modify: `src/utils/profileUrl.test.ts`
- Modify: `src/utils/profileUrl.ts`
- Modify: `src/components/KolDrawer.tsx`

- [ ] **Step 1: Write failing safe-link tests**

```ts
expect(toExternalProfileUrl('youtube.com/@creator')).toBe('https://youtube.com/@creator')
expect(toExternalProfileUrl('javascript:alert(1)')).toBeNull()
expect(toExternalProfileUrl('not a url')).toBeNull()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/utils/profileUrl.test.ts`

Expected: FAIL because `toExternalProfileUrl` is not exported.

- [ ] **Step 3: Implement and wire the helper**

Allow only HTTP(S), prepend `https://` to host-like values, and render the drawer link only for a valid result.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- src/utils/profileUrl.test.ts`

Expected: PASS.

### Task 6: Batch Verification And Commit

**Files:**
- Review all files changed by Tasks 1-5.

- [ ] **Step 1: Run the full test suite**

Run: `npm.cmd test`

Expected: all test files and tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm.cmd run build`

Expected: exit code 0.

- [ ] **Step 3: Review scope and migration safety**

Run: `git diff --check` and `git diff --stat`.

Expected: no whitespace errors; changes limited to Batch 1 files and documentation.

- [ ] **Step 4: Commit the batch**

```bash
git add docs/superpowers src supabase-schema.sql supabase-workflow-links.sql
git commit -m "Fix workflow duplicate and archive links"
```
