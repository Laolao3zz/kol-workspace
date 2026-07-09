import { describe, expect, it } from 'vitest'
import type { Collaboration, Shipment } from '../types'
import {
  buildCompletionCollaborationPayload,
  findCollaborationForShipment,
  mergeCompletionCollaborationPayload,
  withShipmentHistoryMarker,
} from './collaborationArchive'

const baseShipment: Shipment = {
  id: 'shipment-1',
  kol_id: 'kol-1',
  product: 'BY53',
  sample_date: '2026-07-01',
  tracking_number: 'TRACK123',
  shipping_details: 'Receiver details',
  status: '已签收',
  notes: '',
  delivered_at: '2026-07-03',
  progress_status: '已完成',
  progress_notes: '',
  expected_publish_date: '2026-07-20',
  completed_at: '2026-07-12',
  archived_at: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-12T00:00:00Z',
}

describe('buildCompletionCollaborationPayload', () => {
  it('creates a visible collaboration history payload when a shipment is completed', () => {
    const payload = buildCompletionCollaborationPayload(baseShipment, '2026-07-13')

    expect(payload).toMatchObject({
      kol_id: 'kol-1',
      product: 'BY53',
      publish_date: '2026-07-12',
      work_url: '',
      views: null,
      comments: null,
      likes: null,
      fee: '',
    })
    expect(payload.notes).toContain('系统归档')
    expect(payload.notes).toContain('shipment:shipment-1')
    expect(payload.notes).toContain('待补作品链接和效果数据')
  })

  it('falls back to today when the shipment has no completed date', () => {
    const payload = buildCompletionCollaborationPayload(
      { ...baseShipment, completed_at: null },
      '2026-07-13'
    )

    expect(payload.publish_date).toBe('2026-07-13')
  })

  it('matches history records by shipment marker before falling back to product', () => {
    const sameProductWrongShipment: Collaboration = {
      id: 'collab-1',
      kol_id: 'kol-1',
      product: 'BY53',
      publish_date: '2026-06-01',
      work_url: '',
      views: null,
      comments: null,
      likes: null,
      fee: '',
      notes: '系统归档 [shipment:another-shipment]',
    }
    const markedMatch: Collaboration = {
      ...sameProductWrongShipment,
      id: 'collab-2',
      notes: '系统归档 [shipment:shipment-1]',
    }

    expect(findCollaborationForShipment([sameProductWrongShipment, markedMatch], baseShipment)?.id)
      .toBe('collab-2')
  })

  it('adds the shipment marker to existing history notes without deleting user notes', () => {
    const existing: Collaboration = {
      id: 'collab-1',
      kol_id: 'kol-1',
      product: 'BY53',
      publish_date: null,
      work_url: '',
      views: null,
      comments: null,
      likes: null,
      fee: '',
      notes: '用户已经补过的备注',
    }

    const merged = mergeCompletionCollaborationPayload(
      existing,
      buildCompletionCollaborationPayload(baseShipment)
    )

    expect(merged.notes).toContain('用户已经补过的备注')
    expect(merged.notes).toContain('shipment:shipment-1')
  })

  it('can append a shipment marker to archive form notes', () => {
    expect(withShipmentHistoryMarker('正式归档备注', 'shipment-1')).toContain('shipment:shipment-1')
  })
})
