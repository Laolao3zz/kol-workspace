import { describe, expect, it } from 'vitest'
import { buildProgressSubmitPayload } from './progressPayload'

describe('buildProgressSubmitPayload', () => {
  it('fills completed date when progress is marked complete without a date', () => {
    expect(buildProgressSubmitPayload({
      progress_status: '已完成',
      progress_notes: ' 已发布 ',
      completed_at: null,
    }, '2026-07-13')).toEqual({
      progress_status: '已完成',
      progress_notes: '已发布',
      completed_at: '2026-07-13',
    })
  })
})
