import { describe, expect, it } from 'vitest'
import { createProduct, getProducts, updateProduct } from './productService'

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
})
