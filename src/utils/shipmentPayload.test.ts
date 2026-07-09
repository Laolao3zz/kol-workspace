import { describe, expect, it } from 'vitest'
import { buildShipmentSubmitPayload } from './shipmentPayload'

describe('buildShipmentSubmitPayload', () => {
  it('preserves expected publish date when editing logistics fields', () => {
    const payload = buildShipmentSubmitPayload({
      kol_id: 'kol-1',
      product: ' BY53 ',
      sample_date: '2026-07-01',
      tracking_number: ' TRACK123 ',
      shipping_details: ' Address ',
      status: '运输中',
      notes: ' Note ',
      delivered_at: null,
      progress_status: '待发布',
      progress_notes: '',
      expected_publish_date: '2026-07-20',
      completed_at: null,
    })

    expect(payload).toMatchObject({
      product: 'BY53',
      tracking_number: 'TRACK123',
      shipping_details: 'Address',
      notes: 'Note',
      status: '运输中',
      expected_publish_date: '2026-07-20',
    })
  })

  it('sets delivered date when status is signed', () => {
    const payload = buildShipmentSubmitPayload({
      kol_id: 'kol-1',
      product: 'BY53',
      sample_date: null,
      tracking_number: '',
      shipping_details: '',
      status: '已签收',
      notes: '',
      delivered_at: null,
      progress_status: '待制作',
      progress_notes: '',
      expected_publish_date: null,
      completed_at: null,
    }, '2026-07-13')

    expect(payload.status).toBe('已签收')
    expect(payload.delivered_at).toBe('2026-07-13')
  })
})
