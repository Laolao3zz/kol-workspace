import { describe, expect, it } from 'vitest'
import type { Collaboration, Invitation, KOL, Shipment } from '../types'
import { deriveKolStatus } from './kolStatus'

const baseKol: KOL = {
  id: 'kol_1',
  name: 'Creator',
  email: 'creator@example.com',
  homepage_url: '',
  platform: 'YouTube',
  followers: '',
  country: '',
  tags: [],
  status: '未首触',
  sample_product: '',
  sample_date: null,
  tracking_number: '',
  shipping_details: '',
  created_at: '',
  updated_at: '',
}

const invitation = (overrides: Partial<Invitation>): Invitation => ({
  id: 'inv_1',
  kol_id: baseKol.id,
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

const collaboration = (overrides: Partial<Collaboration> = {}): Collaboration => ({
  id: 'col_1',
  kol_id: baseKol.id,
  product: 'BY53',
  publish_date: '2026-06-01',
  work_url: 'https://example.com/video',
  views: 1000,
  comments: null,
  likes: null,
  fee: '',
  notes: '',
  ...overrides,
})

const shipment = (overrides: Partial<Shipment> = {}): Shipment => ({
  id: 'shipment_1',
  kol_id: baseKol.id,
  product: 'BY53',
  sample_date: '2026-05-01',
  tracking_number: 'TRACK123',
  shipping_details: '',
  status: '已签收',
  notes: '',
  delivered_at: '2026-05-08',
  progress_status: '已完成',
  progress_notes: '',
  expected_publish_date: null,
  completed_at: '2026-06-01',
  archived_at: '2026-06-10T00:00:00.000Z',
  created_at: '2026-05-01',
  updated_at: '2026-06-10',
  ...overrides,
})

describe('deriveKolStatus', () => {
  it('keeps company-declined invitations as invitation-level outcomes', () => {
    const status = deriveKolStatus(baseKol, [
      invitation({ decision: '我方拒绝', decision_reason: '本产品不匹配' }),
    ])

    expect(status).toBe('已邀约')
  })

  it('keeps creator-declined invitations as invitation-level outcomes', () => {
    const status = deriveKolStatus(baseKol, [
      invitation({ reply_result: '拒绝合作', decision: '待评估', decision_reason: '档期不合适' }),
    ])

    expect(status).toBe('已邀约')
  })

  it('still advances approved invitations into the sample workflow', () => {
    const status = deriveKolStatus(baseKol, [
      invitation({ reply_result: '同意合作', decision: '继续推进' }),
    ])

    expect(status).toBe('待寄出')
  })

  it('lets a newer invitation become the current state after an archived completed cooperation', () => {
    const status = deriveKolStatus(
      baseKol,
      [invitation({ invited_at: '2026-07-01', replied: false, reply_result: '未回复', decision: '待评估' })],
      [shipment()],
      [collaboration({ publish_date: '2026-06-01' })]
    )

    expect(status).toBe('已邀约')
  })

  it('keeps completed cooperation status when the latest invitation is older than the collaboration', () => {
    const status = deriveKolStatus(
      baseKol,
      [invitation({ invited_at: '2026-05-01', replied: false, reply_result: '未回复', decision: '待评估' })],
      [shipment()],
      [collaboration({ publish_date: '2026-06-01' })]
    )

    expect(status).toBe('合作完成')
  })

  it('keeps completed cooperation status from history when no active shipment remains', () => {
    const status = deriveKolStatus(
      baseKol,
      [],
      [],
      [collaboration({ publish_date: '2026-06-01' })]
    )

    expect(status).toBe('合作完成')
  })
})
