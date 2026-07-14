import { describe, expect, it } from 'vitest'
import migration from '../../supabase-canonicalize-k1.sql?raw'

describe('K1 canonicalization migration', () => {
  it('requires one canonical K1 and updates only explicit approved aliases', () => {
    expect(migration).toContain("name = 'K1' AND status IS DISTINCT FROM '归档'")
    expect(migration).toContain("IN ('k1', 'k1/nas', 'nas/k1')")
    expect(migration).not.toMatch(/LIKE|similarity|levenshtein/i)
  })

  it('updates every workflow source and verifies no aliases remain', () => {
    for (const table of ['invitations', 'shipments', 'collaborations', 'kols']) {
      expect(migration).toContain(`UPDATE public.${table}`)
    }
    expect(migration).toContain('Non-canonical K1 workflow references remain.')
    expect(migration.trimStart()).toMatch(/^BEGIN;/)
    expect(migration.trimEnd()).toMatch(/COMMIT;$/)
  })
})
