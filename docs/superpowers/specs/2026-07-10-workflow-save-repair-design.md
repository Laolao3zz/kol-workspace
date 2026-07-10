# Workflow Save Repair Design

## Goal

Stop shipment and collaboration workflows from failing after their primary record has already been saved. The deployed `kols` table no longer contains `sample_product`, `sample_date`, `tracking_number`, or `shipping_details`, so workflow code must not send those fields to Supabase.

## Data Ownership

- `shipments` is the only persisted source for product, sample date, tracking number, shipping details, delivery, and content progress.
- `kols.status` remains persisted because the current UI filters and summarizes KOLs by this field.
- Legacy shipment fields remain on the frontend `KOL` type for now because `applyKolSnapshot` derives them in memory for existing list and drawer presentation. They are not writable database columns.

## Write Path

All KOL updates pass through a strict persistence whitelist containing only current `kols` columns. Workflow helpers in `KolDrawer` and `ShipmentBoard` submit only the next status. A successful shipment write is therefore not followed by a request containing removed columns.

## Error Handling

Existing user-facing error handling remains unchanged. If the primary shipment or collaboration write fails, the workflow still reports failure. If status synchronization fails for another reason, the workflow reports that error without pretending the primary write was rolled back.

## Testing

- Add a pure regression test proving removed shipment fields cannot enter a KOL update payload.
- Keep existing service and workflow utility tests green.
- Run the complete Vitest suite and production build.
- Search production source for remaining persisted writes of the removed fields.

## Out Of Scope

Product alias cleanup, product merge replacement, Supabase authorization, mobile layout, and KOL drawer visual restructuring are separate repair batches.
