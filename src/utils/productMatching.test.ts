import { describe, expect, it } from 'vitest'
import type { Product } from '../types'
import { getProductName, mergeOpportunityProducts, normalizeProductName } from './productMatching'

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
  it('normalizes legacy null product values to an empty name', () => {
    expect(normalizeProductName(null)).toBe('')
  })

  it('keeps product opportunities limited to managed product records', () => {
    const merged = mergeOpportunityProducts(
      [
        product('Atlas NAS 4-bay'),
        product('Paused Product', { status: '暂停' }),
        product('youyeetoo x1', { status: '归档' }),
      ],
      [' atlas nas 4-bay ', 'Legacy Sample']
    )

    expect(merged.map(getProductName)).toEqual(['Atlas NAS 4-bay', 'Paused Product'])
    expect(typeof merged[0]).toBe('object')
  })
})
