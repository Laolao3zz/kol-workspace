import { describe, expect, it } from 'vitest'
import { collectAllPages } from './pagination'

describe('collectAllPages', () => {
  it('continues past the Supabase row cap until a short page is returned', async () => {
    const source = Array.from({ length: 2005 }, (_, index) => index)
    const ranges: Array<[number, number]> = []

    const rows = await collectAllPages(async (from, to) => {
      ranges.push([from, to])
      return source.slice(from, to + 1)
    }, 1000)

    expect(rows).toHaveLength(2005)
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })
})
