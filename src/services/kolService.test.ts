import { describe, expect, it } from 'vitest'
import type { KOL } from '../types'
import { createKOL, updateKOL } from './kolService'

type KOLWithNotes = KOL & { notes: string }

describe('kolService', () => {
  it('preserves KOL-level notes when creating a KOL in demo mode', async () => {
    const created = await createKOL({
      name: `Notes Creator ${Date.now()}`,
      notes: 'Prefers WhatsApp follow-up.',
    } as Partial<KOL> & Pick<KOL, 'name'> & { notes: string })

    expect((created as KOLWithNotes).notes).toBe('Prefers WhatsApp follow-up.')
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
})
