import { describe, expect, it } from 'vitest'
import {
  analyzeKolProfileUrl,
  getProfileIdentity,
  inferKolProfileFromUrl,
  isUnresolvedContentUrl,
  normalizeProfileUrl,
  toExternalProfileUrl,
  toSafeExternalUrl,
} from './profileUrl'

describe('profileUrl helpers', () => {
  it('infers YouTube channel handle URLs', () => {
    expect(inferKolProfileFromUrl('https://www.youtube.com/@MarquesBrownlee')).toEqual({
      platform: 'YouTube',
      homepage_url: 'https://www.youtube.com/@MarquesBrownlee',
      name: 'MarquesBrownlee',
    })
  })

  it('rejects YouTube content URLs that do not reveal the channel identity', () => {
    expect(inferKolProfileFromUrl('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBeNull()
    expect(isUnresolvedContentUrl('https://youtube.com/watch?v=video-one')).toBe(true)
    expect(isUnresolvedContentUrl('https://youtube.com/shorts/video-two')).toBe(true)
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

  it('maps YouTube profile tabs to the same channel identity', () => {
    expect(getProfileIdentity('https://youtube.com/@Creator/videos')).toBe('youtube:@creator')
    expect(getProfileIdentity('https://youtube.com/@creator/about')).toBe('youtube:@creator')
    expect(inferKolProfileFromUrl('https://youtube.com/@Creator/playlists')?.homepage_url).toBe('https://youtube.com/@Creator')
  })

  it('keeps semantic video query parameters when comparing unresolved content URLs', () => {
    expect(normalizeProfileUrl('https://youtube.com/watch?v=video-one')).toBe('youtube.com/watch?v=video-one')
    expect(normalizeProfileUrl('https://youtube.com/watch?v=video-two')).toBe('youtube.com/watch?v=video-two')
  })

  it('extracts profile identities from TikTok videos and X posts', () => {
    expect(analyzeKolProfileUrl('https://www.tiktok.com/@creator/video/123')?.canonical_profile_url)
      .toBe('https://www.tiktok.com/@creator')
    expect(getProfileIdentity('https://x.com/Creator/status/123')).toBe('x:creator')
    expect(inferKolProfileFromUrl('https://x.com/Creator/status/123')?.homepage_url).toBe('https://x.com/Creator')
  })

  it('rejects Instagram post links that do not contain the author identity', () => {
    expect(isUnresolvedContentUrl('https://instagram.com/reel/ABC123')).toBe(true)
    expect(inferKolProfileFromUrl('https://instagram.com/p/ABC123')).toBeNull()
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
