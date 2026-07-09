import { describe, expect, it } from 'vitest'
import { inferKolProfileFromUrl, normalizeProfileUrl } from './profileUrl'

describe('profileUrl helpers', () => {
  it('infers YouTube channel handle URLs', () => {
    expect(inferKolProfileFromUrl('https://www.youtube.com/@MarquesBrownlee')).toEqual({
      platform: 'YouTube',
      homepage_url: 'https://www.youtube.com/@MarquesBrownlee',
      name: 'MarquesBrownlee',
    })
  })

  it('infers YouTube video URLs as YouTube without inventing a channel name', () => {
    expect(inferKolProfileFromUrl('https://youtu.be/dQw4w9WgXcQ?si=abc')).toEqual({
      platform: 'YouTube',
      homepage_url: 'https://youtu.be/dQw4w9WgXcQ',
    })
  })

  it('infers common social profile platforms and handles', () => {
    expect(inferKolProfileFromUrl('tiktok.com/@creator_lab')?.platform).toBe('TikTok')
    expect(inferKolProfileFromUrl('instagram.com/sarah.creates')?.name).toBe('sarah.creates')
    expect(inferKolProfileFromUrl('x.com/buildinpublic')?.platform).toBe('X')
  })

  it('normalizes URLs for duplicate comparison', () => {
    expect(normalizeProfileUrl('https://www.youtube.com/@Creator/?view=1')).toBe('youtube.com/@creator')
    expect(normalizeProfileUrl(' youtube.com/@Creator/ ')).toBe('youtube.com/@creator')
  })
})
