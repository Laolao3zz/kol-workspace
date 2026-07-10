import { describe, expect, it } from 'vitest'
import {
  buildProductAliasRepairPlan,
  isProductAliasRepairComplete,
  normalizeProductName,
} from './product-alias-repair-utils.mjs'

const aliases = [{ source: 'youyeetoo x1', target: 'X1' }]

describe('product alias repair planner', () => {
  it('normalizes product names without fuzzy matching', () => {
    expect(normalizeProductName('  YouYeetoo   X1  ')).toBe('youyeetoo x1')
    expect(normalizeProductName('X1s')).not.toBe(normalizeProductName('X1'))
  })

  it('groups exact normalized alias references by table', () => {
    const [mapping] = buildProductAliasRepairPlan({
      aliases,
      products: [
        { id: 'product-source', name: ' YouYeetoo   X1 ', status: '归档' },
        { id: 'product-target', name: 'x1', status: '在推' },
      ],
      invitations: [
        { id: 'invitation-1', product: 'YOUYEETOO X1' },
        { id: 'invitation-canonical', product: 'X1' },
      ],
      shipments: [{ id: 'shipment-1', product: ' youyeetoo x1 ' }],
      collaborations: [{ id: 'collaboration-other', product: 'X1s' }],
    })

    expect(mapping).toMatchObject({
      sourceName: 'youyeetoo x1',
      targetName: 'X1',
      sourceProductIds: ['product-source'],
      sourceProductStatuses: ['归档'],
      targetProductId: 'product-target',
      canonicalProductName: 'x1',
      targetProductStatus: '在推',
      references: {
        invitations: ['invitation-1'],
        shipments: ['shipment-1'],
        collaborations: [],
      },
      counts: {
        invitations: 1,
        shipments: 1,
        collaborations: 0,
        total: 2,
      },
      errors: [],
      safeToDeleteSource: false,
    })
  })

  it('allows source deletion only after references are gone', () => {
    const [mapping] = buildProductAliasRepairPlan({
      aliases,
      products: [
        { id: 'product-source', name: 'youyeetoo x1', status: '归档' },
        { id: 'product-target', name: 'X1', status: '在推' },
      ],
      invitations: [],
      shipments: [],
      collaborations: [],
    })

    expect(mapping.errors).toEqual([])
    expect(mapping.safeToDeleteSource).toBe(true)
  })

  it('blocks repair when the canonical product is missing', () => {
    const [mapping] = buildProductAliasRepairPlan({
      aliases,
      products: [{ id: 'product-source', name: 'youyeetoo x1', status: '归档' }],
      invitations: [],
      shipments: [],
      collaborations: [],
    })

    expect(mapping.targetProductId).toBeNull()
    expect(mapping.errors).toEqual(['Canonical product "X1" was not found.'])
    expect(mapping.safeToDeleteSource).toBe(false)
  })

  it('blocks repair when the canonical product is not unique', () => {
    const [mapping] = buildProductAliasRepairPlan({
      aliases,
      products: [
        { id: 'product-source', name: 'youyeetoo x1', status: '归档' },
        { id: 'product-target-1', name: 'X1', status: '在推' },
        { id: 'product-target-2', name: ' x1 ', status: '暂停' },
      ],
      invitations: [],
      shipments: [],
      collaborations: [],
    })

    expect(mapping.targetProductId).toBeNull()
    expect(mapping.errors).toEqual(['Canonical product "X1" is not unique.'])
    expect(mapping.safeToDeleteSource).toBe(false)
  })

  it('blocks deletion unless every source is archived and the target is operational', () => {
    const [activeSource] = buildProductAliasRepairPlan({
      aliases,
      products: [
        { id: 'product-source', name: 'youyeetoo x1', status: '在推' },
        { id: 'product-target', name: 'X1', status: '在推' },
      ],
      invitations: [],
      shipments: [],
      collaborations: [],
    })
    const [archivedTarget] = buildProductAliasRepairPlan({
      aliases,
      products: [
        { id: 'product-source', name: 'youyeetoo x1', status: '归档' },
        { id: 'product-target', name: 'X1', status: '归档' },
      ],
      invitations: [],
      shipments: [],
      collaborations: [],
    })

    expect(activeSource.errors).toEqual(['Source product "youyeetoo x1" must be archived before deletion.'])
    expect(activeSource.safeToDeleteSource).toBe(false)
    expect(archivedTarget.errors).toEqual(['Canonical product "X1" must not be archived.'])
    expect(archivedTarget.safeToDeleteSource).toBe(false)
  })

  it('reports completion only after references and source products are gone', () => {
    const base = {
      errors: [],
      counts: { total: 0 },
    }

    expect(isProductAliasRepairComplete({ ...base, sourceProductIds: ['source'] })).toBe(false)
    expect(isProductAliasRepairComplete({
      ...base,
      sourceProductIds: [],
      counts: { total: 1 },
    })).toBe(false)
    expect(isProductAliasRepairComplete({ ...base, sourceProductIds: [] })).toBe(true)
  })

  it('blocks aliases whose normalized source and target names are identical', () => {
    const [mapping] = buildProductAliasRepairPlan({
      aliases: [{ source: ' X1 ', target: 'x1' }],
      products: [{ id: 'product-target', name: 'X1', status: '在推' }],
      invitations: [],
      shipments: [],
      collaborations: [],
    })

    expect(mapping.errors).toContain('Alias source and target must be different products.')
    expect(mapping.safeToDeleteSource).toBe(false)
  })
})
