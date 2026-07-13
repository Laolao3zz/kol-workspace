import { describe, expect, it } from 'vitest'
import { inferKolProfileFromUrl, normalizeProfileUrl, toExternalProfileUrl, toSafeExternalUrl } from './profileUrl'

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

  it('builds a safe external link when the stored homepage omits the scheme', () => {
    expect(toExternalProfileUrl('youtube.com/@creator')).toBe('https://youtube.com/@creator')
    expect(toExternalProfileUrl(' https://example.com/profile?from=kol ')).toBe('https://example.com/profile?from=kol')
  })

  it('rejects unsafe protocols and non-url labels', () => {
    expect(toExternalProfileUrl('javascript:alert(1)')).toBeNull()
    expect(toExternalProfileUrl('not a url')).toBeNull()
    expect(toExternalProfileUrl('creator-channel')).toBeNull()
  })

  it('treats nullable database URL fields as missing links', () => {
    expect(toSafeExternalUrl(null)).toBeNull()
    expect(toSafeExternalUrl(undefined)).toBeNull()
    expect(toExternalProfileUrl(null)).toBeNull()
  })
})
