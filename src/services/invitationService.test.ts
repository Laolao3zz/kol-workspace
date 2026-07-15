import { describe, expect, it } from 'vitest'
import { AUTO_CREATED_SHIPMENT_NOTE } from '../utils/invitationWorkflow'
import { createInvitation, createInvitations, deleteInvitation, getInvitations, getInvitationsByKOL } from './invitationService'
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
  it('creates multiple product opportunities in one conversation', async () => {
    const conversationId = 'e1aa4f3d-7bca-46ec-839f-bd0e212a23aa'
    const base = {
      kol_id: 'demo-kol-001',
      conversation_id: conversationId,
      direction: 'inbound' as const,
      invited_at: '2026-07-15',
      email_subject: '',
      replied: true,
      reply_result: '沟通中',
      quoted_fee: '',
      decision: '待评估',
      decision_reason: '',
      notes: '',
    }
    const created = await createInvitations([
      { ...base, product: 'K1' },
      { ...base, product: 'X1' },
    ])

    try {
      expect(created).toHaveLength(2)
      expect(new Set(created.map(item => item.conversation_id))).toEqual(new Set([conversationId]))
      expect(created.every(item => item.direction === 'inbound')).toBe(true)
    } finally {
      await Promise.all(created.map(item => deleteInvitation(item.id)))
    }
  })

  it('loads invitations across all KOLs', async () => {
    const invitations = await getInvitations()

    expect(invitations.length).toBeGreaterThan(0)
    expect(new Set(invitations.map(item => item.kol_id)).size).toBeGreaterThan(1)
  })

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
