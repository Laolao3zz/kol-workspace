import { describe, expect, it } from 'vitest'
import type { Collaboration, Shipment } from '../types'
import {
  buildCompletionCollaborationPayload,
  findCollaborationForShipment,
  mergeCompletionCollaborationPayload,
  stripShipmentHistoryMarkers,
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
      shipment_id: 'shipment-1',
      product: 'BY53',
      publish_date: '2026-07-12',
      work_url: '',
      views: null,
      comments: null,
      likes: null,
      fee: '',
    })
    expect(payload.notes).toContain('系统归档')
    expect(payload.notes).not.toContain('shipment:')
    expect(payload.notes).toContain('待补作品链接和效果数据')
  })

  it('falls back to today when the shipment has no completed date', () => {
    const payload = buildCompletionCollaborationPayload(
      { ...baseShipment, completed_at: null },
      '2026-07-13'
    )

    expect(payload.publish_date).toBe('2026-07-13')
  })

  it('matches history records by exact shipment id', () => {
    const sameProductWrongShipment: Collaboration = {
      id: 'collab-1',
      kol_id: 'kol-1',
      shipment_id: 'another-shipment',
      product: 'BY53',
      publish_date: '2026-06-01',
      work_url: '',
      views: null,
      comments: null,
      likes: null,
      fee: '',
      notes: '另一轮合作',
    }
    const linkedMatch: Collaboration = {
      ...sameProductWrongShipment,
      id: 'collab-2',
      shipment_id: 'shipment-1',
      notes: '当前合作',
    }

    expect(findCollaborationForShipment([sameProductWrongShipment, linkedMatch], baseShipment)?.id)
      .toBe('collab-2')
  })

  it('reads a legacy marker only as a compatibility fallback', () => {
    const collaboration: Collaboration = {
      id: 'collab-legacy',
      kol_id: 'kol-1',
      product: 'BY53',
      publish_date: '2026-06-01',
      work_url: '',
      views: null,
      comments: null,
      likes: null,
      fee: '',
      notes: '旧记录 [shipment:shipment-1]',
    }

    expect(findCollaborationForShipment([collaboration], baseShipment)?.id).toBe('collab-legacy')
  })

  it('does not reuse an unlinked collaboration only because the product matches', () => {
    const collaboration: Collaboration = {
      id: 'collab-old-round',
      kol_id: 'kol-1',
      product: ' by53 ',
      publish_date: '2026-06-01',
      work_url: '',
      views: null,
      comments: null,
      likes: null,
      fee: '',
      notes: '上一轮合作',
    }

    expect(findCollaborationForShipment([collaboration], baseShipment)).toBeNull()
  })

  it('preserves user notes while removing legacy markers during merge', () => {
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
      notes: '用户已经补过的备注 [shipment:shipment-1]',
    }

    const merged = mergeCompletionCollaborationPayload(
      existing,
      buildCompletionCollaborationPayload(baseShipment)
    )

    expect(merged.notes).toContain('用户已经补过的备注')
    expect(merged.notes).not.toContain('shipment:')
    expect(merged.shipment_id).toBe('shipment-1')
  })

  it('removes every legacy marker from visible notes', () => {
    expect(stripShipmentHistoryMarkers(
      '正式归档备注 [shipment:shipment-1] 补充说明 [shipment:shipment-2]'
    )).toBe('正式归档备注 补充说明')
  })
})
