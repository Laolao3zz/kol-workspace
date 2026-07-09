import { describe, expect, it } from 'vitest'
import { collectProductOptions } from './productOptions'

describe('collectProductOptions', () => {
  it('builds sorted product suggestions from all workflow records', () => {
    const options = collectProductOptions({
      products: [' BY53 ', 'by53', '', 'K1'],
      kols: [
        { sample_product: ' X1 ' },
        { sample_product: '' },
      ],
      invitations: {
        kol_a: [
          { product: 'NAS' },
          { product: 'nas ' },
        ],
      },
      shipments: [
        { product: ' Lora ' },
      ],
      collaborationsByKol: {
        kol_b: [
          { product: 'Z1' },
        ],
      },
    })

    expect(options).toEqual(['BY53', 'K1', 'Lora', 'NAS', 'X1', 'Z1'])
  })

  it('accepts flat invitation and collaboration lists', () => {
    const options = collectProductOptions({
      invitations: [{ product: 'P1' }],
      collaborations: [{ product: 'P2' }],
    })

    expect(options).toEqual(['P1', 'P2'])
  })
})
