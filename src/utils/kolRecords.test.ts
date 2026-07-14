import { describe, expect, it } from 'vitest'
import { groupRecordsByKol, replaceRecordsForKol } from './kolRecords'

describe('groupRecordsByKol', () => {
  it('groups records and includes empty groups for known KOLs', () => {
    const records = [
      { id: 'inv-1', kol_id: 'kol-1' },
      { id: 'inv-2', kol_id: 'kol-1' },
      { id: 'inv-3', kol_id: 'kol-2' },
    ]

    expect(groupRecordsByKol(records, ['kol-1', 'kol-2', 'kol-3'])).toEqual({
      'kol-1': [records[0], records[1]],
      'kol-2': [records[2]],
      'kol-3': [],
    })
  })
})

describe('replaceRecordsForKol', () => {
  it('replaces only the selected KOL records', () => {
    const records = [
      { id: 'old-1', kol_id: 'kol-1' },
      { id: 'keep', kol_id: 'kol-2' },
      { id: 'old-2', kol_id: 'kol-1' },
    ]
    const replacements = [{ id: 'new', kol_id: 'kol-1' }]

    expect(replaceRecordsForKol(records, 'kol-1', replacements)).toEqual([
      records[1],
      replacements[0],
    ])
  })
})
