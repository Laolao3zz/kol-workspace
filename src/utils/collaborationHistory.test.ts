import { describe, expect, it } from 'vitest'
import { collectCollaborationHistoryProducts } from './collaborationHistory'

describe('collaboration history product filters', () => {
  it('uses only displayed collaboration products and removes empty or case duplicates', () => {
    expect(collectCollaborationHistoryProducts([
      { product: ' K1 ' },
      { product: 'k1' },
      { product: '' },
      { product: 'NAS' },
    ])).toEqual(['K1', 'NAS'])
  })
})
