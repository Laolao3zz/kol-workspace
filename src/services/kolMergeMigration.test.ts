import { describe, expect, it } from 'vitest'
import migration from '../../supabase-merge-kio-diekin.sql?raw'

describe('Kio Diekin duplicate merge migration', () => {
  it('locks exact source and target records and moves every dependent table', () => {
    expect(migration).toContain("name = 'KÎÖ ÐÎÊKÎÑ'")
    expect(migration).toContain("name = 'Kio Diekin'")
    expect(migration.match(/FOR UPDATE;/g)).toHaveLength(2)
    for (const table of ['invitations', 'shipments', 'collaborations', 'emails']) {
      expect(migration).toContain(`UPDATE public.${table} SET kol_id = target_kol.id`)
    }
  })

  it('verifies references before deleting the duplicate inside a transaction', () => {
    expect(migration.trimStart()).toMatch(/^BEGIN;/)
    expect(migration.trimEnd()).toMatch(/COMMIT;$/)
    expect(migration).toContain('References remain on the duplicate Kio Diekin record.')
    expect(migration.indexOf('IF EXISTS (SELECT 1 FROM public.invitations')).toBeLessThan(
      migration.indexOf('DELETE FROM public.kols')
    )
  })
})
