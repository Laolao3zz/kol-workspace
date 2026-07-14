import { describe, expect, it } from 'vitest'
import { canonicalizeProductTags, collectProductTagOptions } from './productTags'

describe('product tag helpers', () => {
  it('collects presets and real tags without case-insensitive duplicates', () => {
    expect(collectProductTagOptions(
      ['SBC', 'NAS'],
      [' nas ', '科技', ''],
      ['sbc', 'Linux'],
    )).toEqual(['SBC', 'NAS', '科技', 'Linux'])
  })

  it('maps existing product tags to canonical option spelling', () => {
    expect(canonicalizeProductTags(
      [' nas ', 'NAS', 'linux', ' Linux '],
      ['NAS', 'Linux'],
    )).toEqual(['NAS', 'Linux'])
  })
})
