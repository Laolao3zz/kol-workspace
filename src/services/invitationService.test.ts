import { describe, expect, it } from 'vitest'
import { AUTO_CREATED_SHIPMENT_NOTE } from '../utils/invitationWorkflow'
import { createInvitation, deleteInvitation, getInvitationsByKOL } from './invitationService'
import { createShipment, deleteShipment, getShipmentsByKOL, updateShipment } from './shipmentService'

const createApprovedInvitation = () => createInvitation({
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

const createLinkedShipment = (sourceInvitationId: string) => createShipment({
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

describe('invitationService workflow deletion', () => {
  it('deletes an untouched auto shipment together with its source invitation', async () => {
    const invitation = await createApprovedInvitation()
    const shipment = await createLinkedShipment(invitation.id)

    try {
      await deleteInvitation(invitation.id)

      expect((await getInvitationsByKOL(invitation.kol_id)).some(item => item.id === invitation.id)).toBe(false)
      expect((await getShipmentsByKOL(invitation.kol_id)).some(item => item.id === shipment.id)).toBe(false)
    } finally {
      await deleteShipment(shipment.id)
      await deleteInvitation(invitation.id)
    }
  })

  it('keeps a started shipment and clears its deleted invitation relation', async () => {
    const invitation = await createApprovedInvitation()
    const shipment = await createLinkedShipment(invitation.id)
    const started = await updateShipment(shipment.id, {
      status: '运输中',
      tracking_number: 'TRACK-DELETE-SAFE',
    })

    try {
      await deleteInvitation(invitation.id)

      const remaining = (await getShipmentsByKOL(invitation.kol_id)).find(item => item.id === started.id)
      expect(remaining?.tracking_number).toBe('TRACK-DELETE-SAFE')
      expect(remaining?.source_invitation_id).toBeNull()
    } finally {
      await deleteShipment(started.id)
      await deleteInvitation(invitation.id)
    }
  })
})
