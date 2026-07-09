# KOL Workspace UI Migration Progress

## Migration Rule

- Copy Figma Make presentation code and visual structure where it does not own business state.
- Keep existing app services, Supabase writes, workflow status derivation, and record relationships as the source of truth.
- Replace Figma Make mock arrays with adapters over real `kols`, `invitations`, `shipments`, and `collaborations`.
- Do not reintroduce the Figma Make bug where "add KOL" opens an invitation modal.

## Done

- Business loop fixes for completion archive, product-level invitation status, dynamic product options, pending shipment cleanup, and publish history linkage.
- Main app shell: left navigation, header, background, type scale, Figma Make color direction.
- Dashboard/workbench: metric cards, pending reply panel, signed-over-7-days panel, pending sample panel, missing work-link panel, recent activity panel.
- Add KOL modal: homepage URL inference for common creator platforms.
- KOL resource pool: Figma Make-style dense resource table, filters, selected-count stats, pagination, empty state, row actions, and batch invitation modal.
- Progress board: four-column Make-style kanban for pending shipment, transit, content follow-up, and archive-ready collaborations.
- Product opportunity: dynamic product tabs, status summaries, searchable KOL opportunity cards, no fake batch action.
- Collaboration history: compact stats bar, search/product filters, and Make-style history table.
- KOL drawer: white side panel, compact identity header, workflow cards, invitation/history sections, and icon-based row actions.
- Key modals: Add KOL, invitation, shipment, content progress, collaboration, and archive dialogs share the new shell and button/input styling.
- Data integrity pass: cross-table refreshes now use one current snapshot, active drawer workflows hide archived shipments, and deletion fallback keeps historical completed cooperation status.

## UI Migration Remaining

- Real Supabase end-to-end QA after `.env.local` is restored locally.

## Verification Checklist

- `npm.cmd run build` - passed after full UI migration.
- `cmd /c npm test -- --run` - passed, 9 files / 27 tests.
- `cmd /c npm run build` - passed after data integrity pass.
- Browser visual QA - passed with demo data: 13 screenshots covering dashboard, resource pool, progress board, product opportunity, history, drawer, key modals, and mobile current-flow view; automated report found 0 issues.
- Confirm Add KOL and invite entry points remain distinct - preserved in code: table header opens `AddKolModal`; dashboard quick invite navigates to resource pool; drawer invite action opens `AddInvitationModal`.

## Current Phase

- UI migration and local/demo verification are complete.
- Local app falls back to demo data when Supabase env vars are missing, so core UI and workflow QA can run without touching production data.
- Remaining verification requires `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then rerun `npm.cmd run health-check` and a real create/update/archive pass against Supabase.
