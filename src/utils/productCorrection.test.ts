import { describe, expect, it } from 'vitest'
import type { Collaboration, Invitation, Shipment } from '../types'
import { buildProductCorrectionPlan, countProductDeletionReferences, countProductReferences, resolveProductSelection } from './productCorrection'

const invitation = (id: string, kolId: string, product: string) => ({ id, kol_id: kolId, product }) as Invitation
const shipment = (id: string, kolId: string, product: string) => ({ id, kol_id: kolId, product }) as Shipment
const collaboration = (id: string, kolId: string, product: string) => ({ id, kol_id: kolId, product }) as Collaboration

describe('product correction rules', () => {
  it('only plans records for the selected KOL and exact source spelling', () => {
    const plan = buildProductCorrectionPlan({
      kolId: 'techno',
      sourceProduct: 'k1',
      targetProduct: 'K1',
      invitations: [
        invitation('inv-lower', 'techno', 'k1'),
        invitation('inv-canonical', 'techno', 'K1'),
        invitation('inv-other-kol', 'other', 'k1'),
      ],
      shipments: [shipment('ship-lower', 'techno', ' k1 ')],
      collaborations: [collaboration('col-nas', 'techno', 'K1/NAS')],
    })

    expect(plan.invitations.map(record => record.id)).toEqual(['inv-lower'])
    expect(plan.shipments.map(record => record.id)).toEqual(['ship-lower'])
    expect(plan.collaborations).toEqual([])
    expect(plan.total).toBe(2)
  })

  it('ignores legacy records whose product is null', () => {
    const plan = buildProductCorrectionPlan({
      kolId: 'techno',
      sourceProduct: 'k1',
      targetProduct: 'K1',
      invitations: [invitation('inv-null', 'techno', null as unknown as string)],
      shipments: [],
      collaborations: [],
    })

    expect(plan.total).toBe(0)
  })

  it('counts references using the same case-insensitive product identity as opportunities', () => {
    const counts = countProductReferences('K1', {
      invitations: [invitation('inv-1', 'techno', 'k1')],
      shipments: [shipment('ship-1', 'other', ' K1 ')],
      collaborations: [collaboration('col-1', 'other', 'K1/NAS')],
    })

    expect(counts).toEqual({ invitations: 1, shipments: 1, collaborations: 0, total: 2 })
  })

  it('allows an unreferenced casing duplicate to be deleted without counting canonical references', () => {
    const counts = countProductDeletionReferences(
      { id: 'product-lower', name: 'k1' },
      [{ id: 'product-canonical', name: 'K1' }, { id: 'product-lower', name: 'k1' }],
      {
        invitations: [invitation('inv-canonical', 'techno', 'K1')],
        shipments: [],
        collaborations: [],
      }
    )

    expect(counts.total).toBe(0)
  })

  it('protects a sole canonical product when references use a casing variant', () => {
    const counts = countProductDeletionReferences(
      { id: 'product-canonical', name: 'K1' },
      [{ id: 'product-canonical', name: 'K1' }],
      {
        invitations: [invitation('inv-lower', 'techno', 'k1')],
        shipments: [],
        collaborations: [],
      }
    )

    expect(counts.total).toBe(1)
  })

  it('selects the first option when async options arrive after an empty initial render', () => {
    expect(resolveProductSelection('', ['K1/NAS'])).toBe('K1/NAS')
  })

  it('prefers the canonical target when correcting a casing variant', () => {
    expect(resolveProductSelection('BY53', ['BY53', 'K1'], 'k1')).toBe('K1')
  })
})
