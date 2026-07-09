import { describe, expect, it } from 'vitest'
import type { Collaboration, Invitation, KOL, Product, Shipment } from '../types'
import { deriveProductDraftsFromHistory } from './productExtraction'

const kol = (id: string, overrides: Partial<KOL> = {}): KOL => ({
  id,
  name: `KOL ${id}`,
  email: '',
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
  ...overrides,
})

const invitation = (overrides: Partial<Invitation>): Invitation => ({
  id: `inv_${overrides.kol_id}_${overrides.product}`,
  kol_id: overrides.kol_id || 'k1',
  product: overrides.product || 'BY53',
  invited_at: '2026-07-01',
  email_subject: '',
  replied: false,
  reply_result: '未回复',
  quoted_fee: '',
  decision: '待评估',
  decision_reason: '',
  notes: '',
  ...overrides,
})

const shipment = (overrides: Partial<Shipment>): Shipment => ({
  id: `ship_${overrides.kol_id}_${overrides.product}`,
  kol_id: overrides.kol_id || 'k1',
  product: overrides.product || 'BY53',
  sample_date: null,
  tracking_number: '',
  shipping_details: '',
  status: '待寄出',
  notes: '',
  delivered_at: null,
  progress_status: '待制作',
  progress_notes: '',
  expected_publish_date: null,
  completed_at: null,
  archived_at: null,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const collaboration = (overrides: Partial<Collaboration>): Collaboration => ({
  id: `col_${overrides.kol_id}_${overrides.product}`,
  kol_id: overrides.kol_id || 'k1',
  product: overrides.product || 'BY53',
  publish_date: '2026-07-01',
  work_url: '',
  views: null,
  comments: null,
  likes: null,
  fee: '',
  notes: '',
  ...overrides,
})

const product = (name: string): Product => ({
  id: `product_${name}`,
  name,
  category: '',
  target_kol_tags: [],
  target_content_shapes: [],
  status: '在推',
  priority: 0,
  notes: '',
  created_at: '',
  updated_at: '',
})

describe('deriveProductDraftsFromHistory', () => {
  it('extracts real historical products and infers tags from linked KOLs', () => {
    const drafts = deriveProductDraftsFromHistory({
      existingProducts: [product('Existing NAS')],
      kols: [
        kol('video-a', { tags: ['NAS', '科技'], sample_product: 'Existing NAS' }),
        kol('video-b', { tags: ['NAS', 'SBC'] }),
        kol('site-a', { platform: 'Blog', tags: ['Linux', 'SBC'] }),
        kol('noise', { tags: ['科技'] }),
      ],
      invitations: {
        'video-b': [
          invitation({ kol_id: 'video-b', product: 'BY53' }),
          invitation({ kol_id: 'video-b', product: '400€' }),
        ],
        'site-a': [invitation({ kol_id: 'site-a', product: 'BY53' })],
        noise: [invitation({ kol_id: 'noise', product: '俄语' })],
      },
      shipments: [
        shipment({ kol_id: 'video-b', product: 'BY53' }),
      ],
      collaborationsByKol: {
        'site-a': [collaboration({ kol_id: 'site-a', product: 'BY53' })],
      },
    })

    expect(drafts.map(draft => draft.name)).toEqual(['BY53'])
    expect(drafts[0].target_kol_tags).toEqual(['SBC', 'NAS', 'Linux'])
    expect(drafts[0].target_content_shapes).toEqual(['视频', '网站'])
    expect(drafts[0].category).toBe('SBC')
    expect(drafts[0].status).toBe('在推')
  })
})
