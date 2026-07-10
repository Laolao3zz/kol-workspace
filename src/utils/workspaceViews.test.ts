import { describe, expect, it } from 'vitest'
import type { Collaboration, Invitation, KOL, Product, Shipment } from '../types'
import {
  buildDashboardMetrics,
  buildProductOpportunitySummary,
  countActiveShipments,
  filterOpportunityRowsByStatus,
  isActionablePendingInvitation,
} from './workspaceViews'

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

const product = (name: string, overrides: Partial<Product> = {}): Product => ({
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
  ...overrides,
})

describe('workspace view helpers', () => {
  it('builds dashboard metrics from real workflow records', () => {
    const metrics = buildDashboardMetrics({
      kols: [kol('k1'), kol('k2'), kol('k3')],
      invitations: {
        k1: [invitation({ kol_id: 'k1', product: 'InviteOnly' })],
      },
      shipments: [
        shipment({ kol_id: 'k1', product: 'BY53', status: '待寄出' }),
        shipment({ kol_id: 'k2', product: 'K1', status: '运输中', tracking_number: 'TRACK' }),
        shipment({ kol_id: 'k3', product: 'R1', status: '已签收', delivered_at: '2026-06-01' }),
        shipment({ kol_id: 'k3', product: 'X1', status: '已签收', progress_status: '已完成', completed_at: '2026-07-01' }),
      ],
      collaborationsByKol: {
        k3: [collaboration({ kol_id: 'k3', product: 'X1' })],
      },
    })

    expect(metrics.totalKols).toBe(3)
    expect(metrics.pendingReplies).toBe(1)
    expect(metrics.pendingShipments).toBe(1)
    expect(metrics.inTransit).toBe(1)
    expect(metrics.contentFollowUp).toBe(1)
    expect(metrics.waitingArchive).toBe(1)
    expect(metrics.completedCollaborations).toBe(1)
  })

  it('counts only actionable recent unresolved invitations as pending replies', () => {
    const metrics = buildDashboardMetrics({
      kols: [kol('active'), kol('stale'), kol('covered')],
      invitations: {
        active: [invitation({ kol_id: 'active', product: 'BY53', invited_at: '2026-07-01' })],
        stale: [invitation({ kol_id: 'stale', product: 'Old Product', invited_at: '2026-04-01' })],
        covered: [invitation({ kol_id: 'covered', product: 'Shipped Product', invited_at: '2026-07-02' })],
      },
      shipments: [
        shipment({ kol_id: 'covered', product: 'Shipped Product', status: '待寄出' }),
      ],
      collaborationsByKol: {},
    })

    expect(metrics.pendingReplies).toBe(1)
  })

  it('keeps unanswered invitations actionable through day 14 and expires them on day 15', () => {
    expect(isActionablePendingInvitation(
      invitation({ invited_at: '2026-06-26' }),
      [],
      [],
      '2026-07-10'
    )).toBe(true)

    expect(isActionablePendingInvitation(
      invitation({ invited_at: '2026-06-25' }),
      [],
      [],
      '2026-07-10'
    )).toBe(false)
  })

  it('does not count completed waiting-archive shipments as active progress', () => {
    const shipments = [
      shipment({ kol_id: 'k1', product: 'Pending', status: '待寄出' }),
      shipment({ kol_id: 'k2', product: 'Transit', status: '运输中', tracking_number: 'TRACK' }),
      shipment({ kol_id: 'k3', product: 'Content', status: '已签收', delivered_at: '2026-07-01' }),
      shipment({ kol_id: 'k4', product: 'Waiting Archive', status: '已签收', progress_status: '已完成', completed_at: '2026-07-02' }),
    ]

    expect(countActiveShipments(shipments)).toBe(3)
  })

  it('separates product-level opportunity statuses from KOL identity', () => {
    const summary = buildProductOpportunitySummary({
      products: ['BY53', 'K1'],
      kols: [kol('k1'), kol('k2')],
      invitations: {
        k1: [invitation({ kol_id: 'k1', product: 'BY53', replied: true, reply_result: '拒绝合作' })],
        k2: [invitation({ kol_id: 'k2', product: 'BY53', replied: true, reply_result: '同意合作', decision: '继续推进' })],
      },
      shipments: [shipment({ kol_id: 'k2', product: 'BY53', status: '已签收' })],
      collaborationsByKol: {},
    })

    const by53 = summary.find(item => item.product === 'BY53')
    expect(by53?.counts['已拒绝']).toBe(1)
    expect(by53?.counts['内容中']).toBe(1)
    expect(by53?.counts['未触达']).toBe(0)

    const k1 = summary.find(item => item.product === 'K1')
    expect(k1?.counts['未触达']).toBe(2)
  })

  it('groups product records that differ only by casing and whitespace', () => {
    const summary = buildProductOpportunitySummary({
      products: ['K1'],
      kols: [kol('technodrive')],
      invitations: {
        technodrive: [invitation({
          kol_id: 'technodrive',
          product: ' k1 ',
          replied: true,
          reply_result: '同意合作',
          decision: '继续推进',
        })],
      },
      shipments: [],
      collaborationsByKol: {},
    })

    expect(summary[0].rows).toHaveLength(1)
    expect(summary[0].rows[0].status).toBe('已同意')
    expect(summary[0].counts['已同意']).toBe(1)
  })

  it('keeps a completed KOL untouched for a new product with no product-level records', () => {
    const summary = buildProductOpportunitySummary({
      products: ['Atlas NAS 4-bay', 'New Launch'],
      kols: [kol('k1', { status: '合作完成' })],
      invitations: {
        k1: [invitation({ kol_id: 'k1', product: 'Atlas NAS 4-bay', replied: true, reply_result: '同意合作', decision: '继续推进' })],
      },
      shipments: [
        shipment({
          kol_id: 'k1',
          product: 'Atlas NAS 4-bay',
          status: '已签收',
          progress_status: '已完成',
          completed_at: '2026-06-01',
          archived_at: '2026-06-10T00:00:00.000Z',
        }),
      ],
      collaborationsByKol: {
        k1: [collaboration({ kol_id: 'k1', product: 'Atlas NAS 4-bay', publish_date: '2026-06-01' })],
      },
    })

    const newLaunch = summary.find(item => item.product === 'New Launch')
    expect(newLaunch?.rows[0].status).toBe('未触达')
    expect(newLaunch?.counts['未触达']).toBe(1)
    expect(newLaunch?.counts['待回复']).toBe(0)
  })

  it('does not use global KOL status as a product opportunity fallback', () => {
    const summary = buildProductOpportunitySummary({
      products: ['New Launch'],
      kols: [kol('k1', { status: '未首触' })],
      invitations: {
        k1: [invitation({
          kol_id: 'k1',
          product: 'New Launch',
          replied: true,
          reply_result: '沟通中',
          decision: '待评估',
        })],
      },
      shipments: [],
      collaborationsByKol: {},
    })

    const newLaunch = summary.find(item => item.product === 'New Launch')
    expect(newLaunch?.rows[0].status).toBe('待回复')
    expect(newLaunch?.counts['待回复']).toBe(1)
  })

  it('marks unanswered product invitations as overdue after 14 days', () => {
    const summary = buildProductOpportunitySummary({
      products: ['K1'],
      kols: [kol('pending'), kol('overdue')],
      invitations: {
        pending: [invitation({
          kol_id: 'pending',
          product: 'K1',
          invited_at: '2026-06-26',
        })],
        overdue: [invitation({
          kol_id: 'overdue',
          product: 'K1',
          invited_at: '2026-06-25',
        })],
      },
      shipments: [],
      collaborationsByKol: {},
      currentDate: '2026-07-10',
    })

    expect(summary[0].rows.find(row => row.kol.id === 'pending')?.status).toBe('待回复')
    expect(summary[0].rows.find(row => row.kol.id === 'overdue')?.status).toBe('未回复')
    expect(summary[0].counts['待回复']).toBe(1)
    expect(summary[0].counts['未回复']).toBe(1)
  })

  it('filters product opportunities by product target KOL tags', () => {
    const summary = buildProductOpportunitySummary({
      products: [
        product('Pocket SBC Kit', { target_kol_tags: ['SBC', 'AI'] }),
        product('TrailCam X2', { target_kol_tags: ['户外装备'] }),
      ],
      kols: [
        kol('outdoor', { tags: ['户外装备', 'Smart Home'] }),
        kol('storage', { tags: ['NAS', 'SBC'] }),
      ],
      invitations: {},
      shipments: [],
      collaborationsByKol: {},
    })

    const sbc = summary.find(item => item.product === 'Pocket SBC Kit')
    expect(sbc?.rows.map(row => row.kol.id)).toEqual(['storage'])

    const trailCam = summary.find(item => item.product === 'TrailCam X2')
    expect(trailCam?.rows.map(row => row.kol.id)).toEqual(['outdoor'])
  })

  it('keeps existing product records visible even when product tags no longer match the KOL', () => {
    const summary = buildProductOpportunitySummary({
      products: [
        product('Pocket SBC Kit', { target_kol_tags: ['SBC'] }),
      ],
      kols: [
        kol('outdoor', { tags: ['户外装备'] }),
        kol('storage', { tags: ['SBC'] }),
      ],
      invitations: {
        outdoor: [
          invitation({
            kol_id: 'outdoor',
            product: 'Pocket SBC Kit',
            replied: false,
            reply_result: '未回复',
          }),
        ],
      },
      shipments: [],
      collaborationsByKol: {},
    })

    const sbc = summary.find(item => item.product === 'Pocket SBC Kit')
    expect(sbc?.rows.map(row => row.kol.id)).toEqual(['outdoor', 'storage'])
    expect(sbc?.rows.find(row => row.kol.id === 'outdoor')?.status).toBe('待回复')
    expect(sbc?.rows.find(row => row.kol.id === 'storage')?.status).toBe('未触达')
  })

  it('filters product opportunity rows by selected status', () => {
    const rows = [
      { kol: kol('untouched'), status: '未触达' as const },
      { kol: kol('pending'), status: '待回复' as const },
      { kol: kol('done'), status: '已完成' as const },
    ]

    expect(filterOpportunityRowsByStatus(rows, '全部').map(row => row.kol.id)).toEqual(['untouched', 'pending', 'done'])
    expect(filterOpportunityRowsByStatus(rows, '未触达').map(row => row.kol.id)).toEqual(['untouched'])
    expect(filterOpportunityRowsByStatus(rows, '已完成').map(row => row.kol.id)).toEqual(['done'])
  })
})
