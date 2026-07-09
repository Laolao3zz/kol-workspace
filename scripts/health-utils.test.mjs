import { describe, expect, it } from 'vitest'
import { findOrphanRows, KOL_HEALTH_COLUMNS, PRODUCT_HEALTH_COLUMNS } from './health-utils.mjs'

describe('findOrphanRows', () => {
  it('does not flag rows whose parent exists outside an arbitrary first page', () => {
    const parents = Array.from({ length: 20 }, (_, index) => ({ id: `kol-${index + 1}` }))
    const children = [
      { id: 'shipment-1', kol_id: 'kol-15' },
      { id: 'shipment-2', kol_id: 'missing-kol' },
    ]

    expect(findOrphanRows(children, parents, 'kol_id').map(row => row.id)).toEqual(['shipment-2'])
  })

  it('checks the KOL profile notes column required by the Figma workspace UI', () => {
    expect(KOL_HEALTH_COLUMNS.split(',').map(column => column.trim())).toContain('notes')
  })

  it('checks product targeting columns required by product opportunities', () => {
    const columns = PRODUCT_HEALTH_COLUMNS.split(',').map(column => column.trim())

    expect(columns).toContain('target_kol_tags')
    expect(columns).toContain('target_content_shapes')
    expect(columns).toContain('status')
  })
})
