import { describe, expect, it } from 'vitest'
import { runProductAliasRepair } from './product-alias-repair-runner.mjs'

const aliases = [{ source: 'youyeetoo x1', target: 'X1' }]

function initialState() {
  return {
    products: [
      { id: 'source', name: 'youyeetoo x1', status: '归档' },
      { id: 'target', name: 'x1', status: '在推' },
    ],
    invitations: [{ id: 'invitation', product: 'YouYeetoo X1' }],
    shipments: [{ id: 'shipment', product: 'youyeetoo x1' }],
    collaborations: [],
  }
}

describe('product alias repair runner', () => {
  it('performs no mutations in dry-run mode', async () => {
    const state = initialState()
    let rewrites = 0
    let deletions = 0

    const result = await runProductAliasRepair({
      aliases,
      apply: false,
      scan: async () => structuredClone(state),
      rewriteReferences: async () => { rewrites += 1 },
      deleteSourceProducts: async () => { deletions += 1 },
    })

    expect(result.mode).toBe('dry-run')
    expect(result.plan[0].counts.total).toBe(2)
    expect(rewrites).toBe(0)
    expect(deletions).toBe(0)
  })

  it('does not delete source products after a rewrite failure', async () => {
    let deletions = 0

    await expect(runProductAliasRepair({
      aliases,
      apply: true,
      scan: async () => initialState(),
      rewriteReferences: async () => { throw new Error('write failed') },
      deleteSourceProducts: async () => { deletions += 1 },
    })).rejects.toThrow('write failed')

    expect(deletions).toBe(0)
  })

  it('rewrites with the stored canonical name before verified deletion', async () => {
    const state = initialState()
    const canonicalNames = []

    const result = await runProductAliasRepair({
      aliases,
      apply: true,
      scan: async () => structuredClone(state),
      rewriteReferences: async mapping => {
        canonicalNames.push(mapping.canonicalProductName)
        for (const table of ['invitations', 'shipments', 'collaborations']) {
          state[table].forEach(row => {
            if (mapping.references[table].includes(row.id)) {
              row.product = mapping.canonicalProductName
            }
          })
        }
      },
      deleteSourceProducts: async mapping => {
        state.products = state.products.filter(product => !mapping.sourceProductIds.includes(product.id))
      },
    })

    expect(canonicalNames).toEqual(['x1'])
    expect(result.mode).toBe('apply')
    expect(result.plan[0].sourceProductIds).toEqual([])
    expect(result.plan[0].counts.total).toBe(0)
  })

  it('fails final verification when source deletion did not take effect', async () => {
    const state = initialState()

    await expect(runProductAliasRepair({
      aliases,
      apply: true,
      scan: async () => structuredClone(state),
      rewriteReferences: async mapping => {
        for (const table of ['invitations', 'shipments', 'collaborations']) {
          state[table].forEach(row => {
            if (mapping.references[table].includes(row.id)) row.product = mapping.canonicalProductName
          })
        }
      },
      deleteSourceProducts: async () => {},
    })).rejects.toThrow('Product alias repair did not complete: youyeetoo x1')
  })
})
