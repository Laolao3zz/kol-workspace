import { describe, expect, it } from 'vitest'
import type { Shipment } from '../types'
import { AUTO_CREATED_SHIPMENT_NOTE } from '../utils/invitationWorkflow'
import { createInvitation, deleteInvitation } from './invitationService'
import {
  createShipment,
  deleteAutoCreatedPendingShipment,
  deleteShipment,
  getShipmentsByKOL,
  updateShipment,
} from './shipmentService'

const input = (sourceInvitationId: string) => ({
  kol_id: 'demo-kol-001',
  source_invitation_id: sourceInvitationId,
  product: 'K1',
  sample_date: null,
  tracking_number: '',
  shipping_details: '',
  status: '待寄出',
  notes: AUTO_CREATED_SHIPMENT_NOTE,
  delivered_at: null,
  progress_status: '待制作',
  progress_notes: '',
  expected_publish_date: null,
  completed_at: null,
  archived_at: null,
})
describe('shipmentService linked workflow safety', () => {
  it('returns the existing shipment when the same invitation is created twice', async () => {
    const sourceInvitationId = `inv-${Date.now()}-idempotent`
    const first = await createShipment(input(sourceInvitationId))

    try {
      const second = await createShipment(input(sourceInvitationId))
      const linked = (await getShipmentsByKOL(first.kol_id))
        .filter(shipment => shipment.source_invitation_id === sourceInvitationId)

      expect(second.id).toBe(first.id)
      expect(linked.map(shipment => shipment.id)).toEqual([first.id])
    } finally {
      await deleteShipment(first.id)
    }
  })

  it('does not delete a linked shipment that has started shipping', async () => {
    const created = await createShipment(input(`inv-${Date.now()}-started`))

    try {
      const started = await updateShipment(created.id, {
        status: '运输中',
        tracking_number: 'TRACK-123',
      })

      await expect(deleteAutoCreatedPendingShipment(started)).resolves.toBe(false)
      const remaining = (await getShipmentsByKOL(created.kol_id)).find(shipment => shipment.id === created.id)
      expect(remaining?.tracking_number).toBe('TRACK-123')
    } finally {
      await deleteShipment(created.id)
    }
  })

  it('conditionally deletes an untouched linked pending shipment', async () => {
    const created = await createShipment(input(`inv-${Date.now()}-stale`))

    await expect(deleteAutoCreatedPendingShipment(created as Shipment)).resolves.toBe(true)
    const remaining = (await getShipmentsByKOL(created.kol_id)).find(shipment => shipment.id === created.id)
    expect(remaining).toBeUndefined()
  })

  it('does not delete a pending shipment when its source invitation is currently approved', async () => {
    const invitation = await createInvitation({
      kol_id: 'demo-kol-001',
      product: 'K1',
      invited_at: '2026-07-13',
      email_subject: '',
      replied: true,
      reply_result: '同意合作',
      quoted_fee: '',
      decision: '继续推进',
      decision_reason: '',
      notes: '',
    })
    const created = await createShipment(input(invitation.id))

    try {
      await expect(deleteAutoCreatedPendingShipment(created)).resolves.toBe(false)
      const remaining = (await getShipmentsByKOL(created.kol_id)).find(shipment => shipment.id === created.id)
      expect(remaining?.id).toBe(created.id)
    } finally {
      await deleteShipment(created.id)
      await deleteInvitation(invitation.id)
    }
  })

  it('keeps a legacy pending shipment without a source invitation for manual review', async () => {
    const created = await createShipment({
      ...input(`inv-${Date.now()}-legacy`),
      source_invitation_id: null,
    })

    try {
      await expect(deleteAutoCreatedPendingShipment(created)).resolves.toBe(false)
      const remaining = (await getShipmentsByKOL(created.kol_id)).find(shipment => shipment.id === created.id)
      expect(remaining?.id).toBe(created.id)
    } finally {
      await deleteShipment(created.id)
    }
  })
})
