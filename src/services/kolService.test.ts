import { describe, expect, it } from 'vitest'
import type { KOL } from '../types'
import { createKOL, sanitizeKOLUpdates, updateKOL } from './kolService'

type KOLWithNotes = KOL & { notes: string }

describe('kolService', () => {
  it('removes legacy shipment fields from KOL updates', () => {
    const updates = sanitizeKOLUpdates({
      status: '运输中',
      sample_product: 'X1',
      sample_date: '2026-07-10',
      tracking_number: 'SF1234567890',
      shipping_details: 'Shenzhen',
    })

    expect(updates).toEqual({ status: '运输中' })
  })

  it('preserves KOL-level notes when creating a KOL in demo mode', async () => {
    const created = await createKOL({
      name: `Notes Creator ${Date.now()}`,
      notes: 'Prefers WhatsApp follow-up.',
    } as Partial<KOL> & Pick<KOL, 'name'> & { notes: string })

    expect((created as KOLWithNotes).notes).toBe('Prefers WhatsApp follow-up.')
  })

  it('blocks duplicate emails even when the display name differs', async () => {
    await expect(createKOL({
      name: `Duplicate Email ${Date.now()}`,
      email: ' ALEX@TECHLAB.EXAMPLE ',
    })).rejects.toThrow('检测到重复 KOL')
  })

  it('blocks a profile subpage that belongs to an existing social account', async () => {
    await expect(createKOL({
      name: `Duplicate Channel ${Date.now()}`,
      homepage_url: 'https://youtube.com/@alextechlab/videos',
    })).rejects.toThrow('检测到重复 KOL')
  })

  it('rejects content URLs that cannot reveal their author', async () => {
    await expect(createKOL({
      name: `Content Link ${Date.now()}`,
      homepage_url: 'https://youtube.com/watch?v=video-id',
    })).rejects.toThrow('内容页面')
  })

  it('allows updating only KOL-level notes', async () => {
    const created = await createKOL({
      name: `Editable Notes Creator ${Date.now()}`,
    })

    const updated = await updateKOL(created.id, {
      notes: 'Send new product briefs in advance.',
    } as Partial<KOL> & { notes: string })

    expect((updated as KOLWithNotes).notes).toBe('Send new product briefs in advance.')
  })

  it('preserves blacklist fields while still removing legacy shipment fields', () => {
    expect(sanitizeKOLUpdates({
      blacklisted_at: '2026-07-14T00:00:00.000Z',
      blacklist_reason: 'Repeated missed commitments',
      sample_product: 'X1',
    })).toEqual({
      blacklisted_at: '2026-07-14T00:00:00.000Z',
      blacklist_reason: 'Repeated missed commitments',
    })
  })
})
