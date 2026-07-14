import { describe, expect, it } from 'vitest'
import type { KOL } from '../types'
import { parseFollowerCount, sortKols } from './kolSorting'

const kol = (id: string, name: string, followers: string): KOL => ({
  id,
  name,
  followers,
  email: '',
  homepage_url: '',
  platform: 'YouTube',
  country: '',
  tags: [],
  status: '未首触',
  sample_product: '',
  sample_date: null,
  tracking_number: '',
  shipping_details: '',
  created_at: `2026-07-0${id}`,
  updated_at: `2026-07-0${id}`,
})

describe('parseFollowerCount', () => {
  it('normalizes common follower formats', () => {
    expect(parseFollowerCount('34K')).toBe(34_000)
    expect(parseFollowerCount('1.5M')).toBe(1_500_000)
    expect(parseFollowerCount('2.6万')).toBe(26_000)
    expect(parseFollowerCount('82,800')).toBe(82_800)
  })
})

describe('sortKols', () => {
  it('sorts by follower count without mutating the source list', () => {
    const source = [kol('1', 'Alpha', '34K'), kol('2', 'Beta', '1.5M')]

    expect(sortKols(source, 'followers_desc', {}, {}).map(item => item.id)).toEqual(['2', '1'])
    expect(source.map(item => item.id)).toEqual(['1', '2'])
  })

  it('sorts by the latest same-day invitation creation time', () => {
    const source = [kol('1', 'Alpha', ''), kol('2', 'Beta', '')]
    const invitations = {
      '1': [{ id: 'i1', kol_id: '1', product: 'K1', invited_at: '2026-07-01', created_at: '2026-07-01T08:00:00Z', email_subject: '', replied: false, reply_result: '', quoted_fee: '', decision: '待评估', decision_reason: '', notes: '' }],
      '2': [{ id: 'i2', kol_id: '2', product: 'K1', invited_at: '2026-07-01', created_at: '2026-07-01T09:00:00Z', email_subject: '', replied: false, reply_result: '', quoted_fee: '', decision: '待评估', decision_reason: '', notes: '' }],
    }

    expect(sortKols(source, 'invitation_desc', invitations, {}).map(item => item.id)).toEqual(['2', '1'])
  })
})
