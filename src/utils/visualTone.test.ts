import { describe, expect, it } from 'vitest'
import { getAvatarTone, getTagTone } from './visualTone'

describe('visual tones', () => {
  it('keeps colors stable across casing and surrounding whitespace', () => {
    expect(getAvatarTone(' TechnoDrive ')).toBe(getAvatarTone('technodrive'))
    expect(getTagTone(' NAS ')).toBe(getTagTone('nas'))
  })

  it('uses complete static Tailwind class names', () => {
    expect(getAvatarTone('Creator')).toMatch(/^bg-\w+-\d+ text-white$/)
    expect(getTagTone('SBC')).toMatch(/^bg-\w+-50 text-\w+-\d+$/)
  })
})
