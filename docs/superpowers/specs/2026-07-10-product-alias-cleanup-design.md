# Product Alias Cleanup Design

## Goal

Remove archived or misidentified product aliases from normal product opportunities and replace the unsafe daily merge workflow with a one-time, auditable cleanup command.

## Evidence

The deployed workspace currently contains both `X1` and archived `youyeetoo x1`. The `X1` opportunity has 17 completed KOL records, while `youyeetoo x1` has zero linked KOL records. The remaining visible confusion is therefore the archived duplicate product itself, not unconverted workflow history.

The existing browser-side merge sends concurrent updates to `products`, `invitations`, `shipments`, `collaborations`, and the removed `kols.sample_product` column. These requests are not transactional. A failure can leave some tables updated while the UI reports that the merge failed.

## Product Opportunity Behavior

- Products with status `归档` are excluded from opportunity tabs and the normal product-library list.
- Active and paused products remain visible and editable.
- Historical workflow product options remain available where existing records need to be displayed or edited.
- The daily product-management UI no longer exposes a merge action.

## One-Time Repair Command

The explicit alias map initially contains `youyeetoo x1 -> X1`. Matching is case-insensitive and collapses surrounding or repeated whitespace, but it does not use fuzzy matching. Similar valid names such as `X1`, `X1s`, and `K1` must never be guessed as aliases.

The command scans `products`, `invitations`, `shipments`, and `collaborations`, then prints counts for each mapping. Dry-run is the default. With `--apply`, it rewrites matching workflow rows by ID using the exact canonical product name stored in the database, rescans all affected tables, and deletes duplicate source product rows only when no alias references remain. It never writes legacy shipment fields to `kols`.

The operation is restartable: updates set a canonical value, completed rows no longer match the alias, and source deletion happens only after verification. A partial failure can be resolved by rerunning the same command.

## Safety And Errors

- Missing Supabase configuration stops with a clear error.
- Configuration is parsed directly from the current repository's `.env.local`; inherited shell variables are ignored.
- Scans use `SUPABASE_SERVICE_ROLE_KEY` so the verification is not limited by anonymous-role RLS visibility.
- Apply requires an explicit `--project-ref` matching the sanitized target printed by dry-run.
- A mapping with no unique canonical product is blocked.
- Multiple products with the canonical normalized name are blocked.
- Source products must already be archived, and the canonical target must not be archived.
- Failed updates stop processing and preserve the source product for another run.
- Stable `id` ordering is used when scanning paginated tables.
- The script outputs aggregate counts and product names, not KOL personal data.

## Testing

- Unit-test archived-product exclusion.
- Unit-test alias normalization, reference counting, missing-target blocking, and safe source deletion decisions.
- Test the repair runner's dry-run, partial-failure, rescan, deletion, and final-verification branches without a database.
- Run the repair command without database configuration only as an error-path check; do not apply it to production in this batch.
- Run all Vitest tests, the production build, stale merge searches, and `git diff --check`.

## Out Of Scope

Applying the cleanup to production, adding fuzzy product recognition, correcting additional unconfirmed product names, mobile layout, authentication/RLS, and the KOL drawer column layout are separate actions.
