import { describe, expect, it } from 'vitest'
import { canonicalizeTags, collectTagOptions } from './tags'

describe('shared KOL tags', () => {
  it('builds options from real tags without case duplicates', () => {
    expect(new Set(collectTagOptions(['SBC', 'NAS'], [' sbc ', '科技'], ['nas'])))
      .toEqual(new Set(['NAS', 'SBC', '科技']))
  })

  it('uses the existing spelling when adding or saving tags', () => {
    expect(canonicalizeTags(['sbc', ' NAS ', 'Sbc'], ['SBC', 'NAS']))
      .toEqual(['NAS', 'SBC'])
  })

  it('prefers established acronym casing when variants have equal usage', () => {
    expect(collectTagOptions(['Sbc'], ['SBC'], ['Nas'], ['NAS']))
      .toEqual(['NAS', 'SBC'])
  })
})
