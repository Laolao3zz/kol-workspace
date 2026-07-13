import { describe, expect, it } from 'vitest'
import type { Invitation, Shipment } from '../types'
import {
  AUTO_CREATED_SHIPMENT_NOTE,
  findStaleAutoCreatedPendingShipments,
  isInvitationApprovedForShipment,
  shouldCreateShipmentForInvitation,
} from './invitationWorkflow'

const invitation = (overrides: Partial<Invitation> = {}): Invitation => ({
  id: 'inv_1',
  kol_id: 'kol_1',
  product: 'BY53',
  invited_at: '2026-07-01',
  email_subject: '',
  replied: true,
  reply_result: '同意合作',
  quoted_fee: '',
  decision: '继续推进',
  decision_reason: '',
  notes: '',
  ...overrides,
})

const shipment = (overrides: Partial<Shipment> = {}): Shipment => ({
  id: 'shipment_1',
  kol_id: 'kol_1',
  product: 'BY53',
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
  created_at: '2026-07-01',
  updated_at: '2026-07-01',
  ...overrides,
})

describe('invitation workflow helpers', () => {
  it('recognizes only continue-pushing agreed invitations as shipment-approved', () => {
    expect(isInvitationApprovedForShipment(invitation())).toBe(true)
    expect(isInvitationApprovedForShipment(invitation({ decision: '我方拒绝' }))).toBe(false)
    expect(isInvitationApprovedForShipment(invitation({ reply_result: '拒绝合作', decision: '待评估' }))).toBe(false)
  })

  it('creates a shipment for a newly approved invitation', () => {
    expect(shouldCreateShipmentForInvitation(null, invitation())).toBe(true)
  })

  it('creates a shipment when an existing invitation becomes approved', () => {
    const previous = invitation({ decision: '待评估' })

    expect(shouldCreateShipmentForInvitation(previous, invitation())).toBe(true)
  })

  it('does not create another shipment when an approved invitation remains approved', () => {
    const previous = invitation({ notes: 'initial note', quoted_fee: '$100' })
    const next = invitation({ notes: 'updated note', quoted_fee: '$120' })

    expect(shouldCreateShipmentForInvitation(previous, next)).toBe(false)
  })

  it('does not create a shipment when the next invitation is not approved', () => {
    const next = invitation({ decision: '我方拒绝' })

    expect(shouldCreateShipmentForInvitation(invitation(), next)).toBe(false)
  })

  it('finds stale auto-created pending shipments when approval is withdrawn', () => {
    const stale = findStaleAutoCreatedPendingShipments(
      [shipment()],
      [invitation({ decision: '我方拒绝' })]
    )

    expect(stale.map(item => item.id)).toEqual(['shipment_1'])
  })

  it('keeps auto-created pending shipments while an approved invitation still exists for the product', () => {
    const stale = findStaleAutoCreatedPendingShipments(
      [shipment()],
      [
        invitation({ id: 'old_inv', decision: '我方拒绝' }),
        invitation({ id: 'new_inv', product: 'BY53', decision: '继续推进' }),
      ]
    )

    expect(stale).toEqual([])
  })

  it('does not remove manual or already-started shipment records', () => {
    const stale = findStaleAutoCreatedPendingShipments(
      [
        shipment({ id: 'manual', notes: 'manual shipment' }),
        shipment({ id: 'tracking_added', tracking_number: 'TRACK123', status: '运输中' }),
      ],
      []
    )

    expect(stale).toEqual([])
  })
})
