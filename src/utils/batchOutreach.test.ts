import { describe, expect, it } from 'vitest'
import { buildBatchOutreachSelection } from './batchOutreach'

describe('batch outreach selection', () => {
  it('copies unique valid recipients while retaining each valid KOL', () => {
    const result = buildBatchOutreachSelection([
      { id: '1', name: 'Alpha', email: ' alpha@example.com ' },
      { id: '2', name: 'Beta', email: 'ALPHA@example.com' },
      { id: '3', name: 'Gamma', email: 'gamma@example.com' },
    ])

    expect(result.recipientText).toBe('alpha@example.com, gamma@example.com')
    expect(result.validKols.map(kol => kol.id)).toEqual(['1', '2', '3'])
  })

  it('excludes missing and malformed emails from outreach', () => {
    const result = buildBatchOutreachSelection([
      { id: '1', name: 'Missing', email: '' },
      { id: '2', name: 'Malformed', email: 'not-an-email' },
      { id: '3', name: 'Valid', email: 'valid@example.com' },
    ])

    expect(result.validKols.map(kol => kol.id)).toEqual(['3'])
    expect(result.missingEmailKols.map(kol => kol.id)).toEqual(['1', '2'])
  })
})
