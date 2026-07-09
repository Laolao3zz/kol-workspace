import { describe, expect, it } from 'vitest'
import type { Product } from '../types'
import { getProductName, mergeOpportunityProducts } from './productMatching'

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

describe('product matching helpers', () => {
  it('prefers product master records while preserving workflow-only product names', () => {
    const merged = mergeOpportunityProducts(
      [product('Atlas NAS 4-bay'), product('TrailCam X2')],
      [' atlas nas 4-bay ', 'Legacy Sample']
    )

    expect(merged.map(getProductName)).toEqual(['Atlas NAS 4-bay', 'TrailCam X2', 'Legacy Sample'])
    expect(typeof merged[0]).toBe('object')
    expect(merged[2]).toBe('Legacy Sample')
  })
})
