import { describe, expect, it } from 'vitest'
import type { Collaboration, Invitation, Shipment } from '../types'
import type { ProductCorrectionPlan } from '../utils/productCorrection'
import { applyProductCorrection } from './productCorrectionService'
import { createInvitation, deleteInvitation } from './invitationService'

const plan: ProductCorrectionPlan = {
  invitations: [{ id: 'inv-1', kol_id: 'kol-1', product: 'k1' } as Invitation],
  shipments: [{ id: 'ship-1', kol_id: 'kol-1', product: 'k1' } as Shipment],
  collaborations: [{ id: 'col-1', kol_id: 'kol-1', product: 'k1' } as Collaboration],
  total: 3,
}

describe('product correction service', () => {
  it('attempts every record and reports failures without hiding successful updates', async () => {
    const calls: string[] = []

    const result = await applyProductCorrection(plan, 'K1', {
      updateInvitation: async (record, targetProduct) => {
        calls.push(`invitation:${record.id}:${record.kol_id}:${record.product}->${targetProduct}`)
        throw new Error('邀约更新失败')
      },
      updateShipment: async (record, targetProduct) => {
        calls.push(`shipment:${record.id}:${record.kol_id}:${record.product}->${targetProduct}`)
      },
      updateCollaboration: async (record, targetProduct) => {
        calls.push(`collaboration:${record.id}:${record.kol_id}:${record.product}->${targetProduct}`)
      },
    })

    expect(calls).toEqual([
      'invitation:inv-1:kol-1:k1->K1',
      'shipment:ship-1:kol-1:k1->K1',
      'collaboration:col-1:kol-1:k1->K1',
    ])
    expect(result.attempted).toBe(3)
    expect(result.succeeded).toBe(2)
    expect(result.failures).toEqual([
      { kind: 'invitation', id: 'inv-1', message: '邀约更新失败' },
    ])
  })

  it('treats an already-applied stale plan as an idempotent success', async () => {
    const sourceProduct = `source-${Date.now()}`
    const created = await createInvitation({
      kol_id: 'demo-kol-001',
      product: sourceProduct,
      invited_at: '2026-07-10',
      email_subject: '',
      replied: false,
      reply_result: '未回复',
      quoted_fee: '',
      decision: '待评估',
      decision_reason: '',
      notes: '',
    })
    const stalePlan: ProductCorrectionPlan = {
      invitations: [created],
      shipments: [],
      collaborations: [],
      total: 1,
    }

    try {
      const first = await applyProductCorrection(stalePlan, 'K1')
      const second = await applyProductCorrection(stalePlan, 'K1')

      expect(first.failures).toHaveLength(0)
      expect(second.failures).toHaveLength(0)
      expect(second.succeeded).toBe(1)
    } finally {
      await deleteInvitation(created.id)
    }
  })
})
