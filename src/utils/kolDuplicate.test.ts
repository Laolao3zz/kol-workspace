import { describe, expect, it } from 'vitest'
import type { KOL } from '../types'
import { findKolDuplicateMatches, hasBlockingKolDuplicate } from './kolDuplicate'

const kol = (overrides: Partial<KOL> = {}): KOL => ({
  id: 'kol-1',
  name: 'Creator Lab',
  email: 'hello@example.com',
  homepage_url: 'https://www.youtube.com/@CreatorLab',
  platform: 'YouTube',
  followers: '',
  country: '',
  tags: [],
  status: '未首触',
  sample_product: '',
  sample_date: null,
  tracking_number: '',
  shipping_details: '',
  created_at: '',
  updated_at: '',
  ...overrides,
})

describe('findKolDuplicateMatches', () => {
  it('blocks the same social account when a profile subpage is pasted', () => {
    const matches = findKolDuplicateMatches({
      name: 'Different display name',
      homepage_url: 'https://youtube.com/@creatorlab/videos',
    }, [kol()])

    expect(hasBlockingKolDuplicate(matches)).toBe(true)
    expect(matches[0].fields).toContain('平台账号')
  })

  it('blocks an exact normalized email match', () => {
    const matches = findKolDuplicateMatches({ email: ' HELLO@EXAMPLE.COM ' }, [kol()])
    expect(matches[0]).toMatchObject({ level: 'blocking', fields: ['邮箱'] })
  })

  it('only warns for a matching name', () => {
    const matches = findKolDuplicateMatches({ name: ' creator  lab ' }, [kol()])
    expect(matches[0]).toMatchObject({ level: 'warning', fields: ['名称'] })
    expect(hasBlockingKolDuplicate(matches)).toBe(false)
  })

  it('warns rather than blocks for another page on the same website', () => {
    const existing = kol({ homepage_url: 'https://creator.example/about' })
    const matches = findKolDuplicateMatches({ homepage_url: 'https://creator.example/blog/post' }, [existing])
    expect(matches[0]).toMatchObject({ level: 'warning', fields: ['同一网站域名'] })
  })
})
