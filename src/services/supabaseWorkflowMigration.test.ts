import { describe, expect, it } from 'vitest'
import canonicalSchema from '../../supabase-schema.sql?raw'
import workflowMigration from '../../supabase-workflow-links.sql?raw'

describe('workflow migration safety contract', () => {
  it('backfills the shipment fields required by the workflow RPC', () => {
    expect(workflowMigration).toMatch(/ADD COLUMN IF NOT EXISTS progress_status TEXT/i)
    expect(workflowMigration).toMatch(/ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ/i)
    expect(workflowMigration).toMatch(/ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ/i)
  })

  it('aborts instead of erasing unresolved shipment markers', () => {
    expect(workflowMigration).toContain("AS marker(match)")
    expect(workflowMigration).toContain("ON lower(shipment.id::text) = lower(marker.match[1])")
    expect(workflowMigration).toContain("WHERE shipment.id IS NULL")
    expect(workflowMigration).toContain('无法解析或不存在的 shipment 标记')
  })

  it('rejects marker links that cross KOL records', () => {
    expect(workflowMigration).toContain('collaboration.kol_id IS DISTINCT FROM shipment.kol_id')
    expect(workflowMigration).toContain('shipment marker 与合作历史的 KOL')
  })

  it('backfills relation columns before canonical workflow functions are created', () => {
    expect(canonicalSchema).toMatch(/ALTER TABLE public\.shipments[\s\S]*ADD COLUMN IF NOT EXISTS source_invitation_id UUID/i)
    expect(canonicalSchema).toMatch(/ALTER TABLE public\.collaborations[\s\S]*ADD COLUMN IF NOT EXISTS shipment_id UUID/i)
  })

  it('uses one lock order and preserves edited shipments during invitation deletion', () => {
    const staleStart = workflowMigration.indexOf('CREATE OR REPLACE FUNCTION public.delete_stale_auto_shipment')
    const invitationDeleteStart = workflowMigration.indexOf('CREATE OR REPLACE FUNCTION public.delete_invitation_with_stale_shipment')
    const staleFunction = workflowMigration.slice(staleStart, invitationDeleteStart)
    const invitationDeleteFunction = workflowMigration.slice(invitationDeleteStart, workflowMigration.indexOf('COMMIT;'))

    expect(staleFunction.indexOf('FOR SHARE;')).toBeLessThan(staleFunction.indexOf('FOR UPDATE;'))
    expect(invitationDeleteFunction.indexOf('FROM public.invitations')).toBeLessThan(
      invitationDeleteFunction.indexOf('FROM public.shipments')
    )
    expect(staleFunction).toContain('v_shipment.updated_at IS DISTINCT FROM v_shipment.created_at')
    expect(invitationDeleteFunction).toContain('shipment.updated_at IS NOT DISTINCT FROM shipment.created_at')
  })
})
