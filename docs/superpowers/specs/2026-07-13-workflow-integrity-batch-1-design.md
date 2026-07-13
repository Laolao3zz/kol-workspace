# Workflow Integrity Batch 1 Design

## Scope

This batch stops three confirmed production problems without changing database access policy:

1. Editing an already-approved invitation must not create another shipment.
2. A shipment must map to its invitation and collaboration through dedicated IDs rather than user-visible notes.
3. KOL homepage links must open valid external HTTP(S) URLs even when the stored value omits the scheme.

Product cleanup, bulk outreach, avatar/tag colors, status reconciliation, and performance work remain in later approved batches.

## Data Model

`shipments.source_invitation_id` is a nullable foreign key to `invitations.id`. New automatically created shipments always populate it. A partial unique index guarantees at most one shipment per source invitation while preserving legacy and manually created shipments with no source invitation.

`collaborations.shipment_id` is a nullable foreign key to `shipments.id`. New completion and archive records always populate it. A partial unique index guarantees at most one collaboration per shipment while allowing historical manual collaborations with no shipment.

The migration backfills `collaborations.shipment_id` only from an exact legacy `[shipment:<uuid>]` marker whose shipment exists. It then removes markers from visible notes. It does not guess ambiguous invitation-to-shipment relationships or delete production rows.

## Invitation Workflow

Automatic shipment creation is event-based:

- New approved invitation: create or reuse the shipment for that invitation.
- Existing invitation changes from not approved to approved: create or reuse it.
- Existing approved invitation only changes notes, fee, subject, or date: do not create a shipment.
- Approval is withdrawn: remove only an untouched auto-created pending shipment linked to that invitation; retain edited, in-transit, legacy, and manually created shipments.

The service sends `source_invitation_id` on automatic creation, and database uniqueness provides the final duplicate guard. Legacy records with no source ID are never guessed from product text and are left for manual review instead of automatic deletion.

Invitation deletion and untouched-shipment cleanup run in one database transaction. Both cleanup functions lock the invitation before the shipment, preventing the opposite lock order that could deadlock. Follow-up refresh failures are reported as partial success so a completed invitation write is never presented as a failed save.

## Collaboration Workflow

Completion and archive look up collaborations by `shipment_id`, with legacy marker parsing retained only for migration compatibility. Same-KOL/same-product history is never treated as the same shipment merely because it is the only product match. Both completion and formal archive recover a concurrent unique conflict by reading and updating the collaboration that won the insert race.

Internal markers are stripped before notes reach the archive form, KOL drawer, or collaboration history. New notes never receive a marker. The dedicated relation field carries identity.

## Homepage Links

A shared helper converts a host-like value such as `youtube.com/@creator` to `https://youtube.com/@creator`, preserves existing HTTP(S) links, and rejects invalid or non-HTTP(S) schemes. Nullable homepage and work URL fields are treated as missing, and the UI renders links only when this helper returns a safe URL.

## Compatibility And Rollout

The SQL migration is idempotent and stored as a standalone file so it can be run in Supabase without copying prose or error messages. It must be applied before deploying the frontend commit that writes the new relation fields.

No live database writes are performed by this implementation session. The user applies the SQL and pushes commits using the established workflow.

## Verification

- Unit tests cover approval transitions, metadata-only edits, linked stale shipment cleanup, legacy manual-review behavior, shipment-specific collaboration matching, marker stripping, migration contracts, and safe nullable external URLs.
- Full Vitest suite and production build must pass.
- A final diff review must confirm that no RLS or permission policy changed.
