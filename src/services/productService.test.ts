import { describe, expect, it } from 'vitest'
import { createProduct, getProducts, mergeProducts, updateProduct } from './productService'
import { createKOL, getKOLs } from './kolService'
import { createInvitation, getInvitationsByKOL } from './invitationService'
import { createShipment, getShipments } from './shipmentService'
import { createCollaboration, getCollaborationsByKOL } from './collaborationService'

describe('productService', () => {
  it('creates products with targeting metadata in demo mode', async () => {
    const created = await createProduct({
      name: `Demo Product ${Date.now()}`,
      category: 'SBC',
      target_kol_tags: ['SBC', 'AI'],
      target_content_shapes: ['视频'],
      status: '在推',
      priority: 80,
      notes: 'Prioritize technical reviewers.',
    })

    expect(created.name).toContain('Demo Product')
    expect(created.target_kol_tags).toEqual(['SBC', 'AI'])
    expect(created.target_content_shapes).toEqual(['视频'])
    expect(created.status).toBe('在推')

    const products = await getProducts()
    expect(products.some(product => product.id === created.id)).toBe(true)
  })

  it('updates product targeting fields in demo mode', async () => {
    const created = await createProduct({
      name: `Editable Product ${Date.now()}`,
      category: 'Outdoor',
      target_kol_tags: ['户外装备'],
      target_content_shapes: ['视频'],
      status: '在推',
      priority: 40,
      notes: '',
    })

    const updated = await updateProduct(created.id, {
      target_kol_tags: ['户外装备', 'Smart Home'],
      target_content_shapes: ['视频', '网站'],
      status: '暂停',
      priority: 20,
    })

    expect(updated.target_kol_tags).toEqual(['户外装备', 'Smart Home'])
    expect(updated.target_content_shapes).toEqual(['视频', '网站'])
    expect(updated.status).toBe('暂停')
    expect(updated.priority).toBe(20)
  })

  it('merges duplicate products and rewrites historical product names in demo mode', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const targetName = `X1 Canonical ${suffix}`
    const sourceName = `youyeetoo x1 Duplicate ${suffix}`
    const target = await createProduct({
      name: targetName,
      category: 'SBC',
      target_kol_tags: ['SBC'],
      target_content_shapes: ['视频'],
      status: '在推',
      priority: 40,
      notes: 'Keep this product.',
    })
    const source = await createProduct({
      name: sourceName,
      category: '科技',
      target_kol_tags: ['科技', 'Linux'],
      target_content_shapes: ['网站'],
      status: '在推',
      priority: 80,
      notes: 'Duplicate spelling.',
    })
    const kol = await createKOL({
      name: `Merge Test KOL ${suffix}`,
      platform: 'YouTube',
      tags: ['SBC'],
      sample_product: sourceName,
    })

    await createInvitation({
      kol_id: kol.id,
      product: sourceName,
      invited_at: '2026-07-01',
      email_subject: '',
      replied: false,
      reply_result: '未回复',
      quoted_fee: '',
      decision: '待评估',
      decision_reason: '',
      notes: '',
    })
    await createShipment({
      kol_id: kol.id,
      product: sourceName,
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
    })
    await createCollaboration({
      kol_id: kol.id,
      product: sourceName,
      publish_date: '2026-07-02',
      work_url: 'https://example.com/review',
      views: 100,
      comments: 2,
      likes: 5,
      fee: '',
      notes: '',
    })

    const merged = await mergeProducts({
      sourceProductId: source.id,
      targetProductId: target.id,
    })

    expect(merged.target.name).toBe(targetName)
    expect(merged.target.target_kol_tags).toEqual(['SBC', '科技', 'Linux'])
    expect(merged.target.target_content_shapes).toEqual(['视频', '网站'])
    expect(merged.source.status).toBe('归档')

    const products = await getProducts()
    const kols = await getKOLs()
    expect(products.find(product => product.id === source.id)?.status).toBe('归档')
    expect(kols.find(item => item.id === kol.id)).toMatchObject({ sample_product: targetName })
    expect((await getInvitationsByKOL(kol.id)).some(invitation => invitation.product === sourceName)).toBe(false)
    expect((await getInvitationsByKOL(kol.id)).some(invitation => invitation.product === targetName)).toBe(true)
    expect((await getShipments()).some(shipment => shipment.kol_id === kol.id && shipment.product === sourceName)).toBe(false)
    expect((await getShipments()).some(shipment => shipment.kol_id === kol.id && shipment.product === targetName)).toBe(true)
    expect((await getCollaborationsByKOL(kol.id)).some(collaboration => collaboration.product === sourceName)).toBe(false)
    expect((await getCollaborationsByKOL(kol.id)).some(collaboration => collaboration.product === targetName)).toBe(true)
  })
})
