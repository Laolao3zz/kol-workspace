export interface InferredKolProfile {
  platform: string
  homepage_url: string
  name?: string
}

export type ProfileUrlKind = 'profile' | 'content' | 'website'

export interface ProfileUrlAnalysis {
  platform: string
  kind: ProfileUrlKind
  original_url: string
  canonical_profile_url: string | null
  identity: string | null
  site_host: string | null
  name?: string
}

const platformByHost: Array<{ pattern: RegExp; platform: string }> = [
  { pattern: /(^|\.)youtube\.com$/, platform: 'YouTube' },
  { pattern: /(^|\.)youtu\.be$/, platform: 'YouTube' },
  { pattern: /(^|\.)tiktok\.com$/, platform: 'TikTok' },
  { pattern: /(^|\.)instagram\.com$/, platform: 'Instagram' },
  { pattern: /(^|\.)x\.com$/, platform: 'X' },
  { pattern: /(^|\.)twitter\.com$/, platform: 'X' },
  { pattern: /(^|\.)xiaohongshu\.com$/, platform: '小红书' },
  { pattern: /(^|\.)weibo\.com$/, platform: '微博' },
]

const trackingParams = new Set(['feature', 'si', 'ref', 'source', 'share', 'fbclid', 'gclid'])
const instagramContentPaths = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'direct', 'accounts'])
const xReservedPaths = new Set(['home', 'explore', 'i', 'search', 'settings', 'messages', 'notifications', 'compose'])

function parseUrl(value: string): URL | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

function cleanHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
}

function cleanPath(pathname: string): string {
  return pathname.replace(/\/+$/, '')
}

function formatUrl(url: URL, pathname = cleanPath(url.pathname)): string {
  return `${url.protocol}//${url.hostname}${pathname}`
}

function getPlatform(host: string): string | null {
  return platformByHost.find(item => item.pattern.test(host))?.platform || null
}

function pathSegments(url: URL): string[] {
  return cleanPath(url.pathname).split('/').filter(Boolean).map(segment => decodeURIComponent(segment))
}

function socialAnalysis(
  url: URL,
  platform: string,
  kind: ProfileUrlKind,
  canonicalPath: string | null,
  identity: string | null,
  name?: string
): ProfileUrlAnalysis {
  return {
    platform,
    kind,
    original_url: formatUrl(url),
    canonical_profile_url: canonicalPath ? formatUrl(url, canonicalPath) : null,
    identity,
    site_host: null,
    ...(name ? { name } : {}),
  }
}

export function analyzeKolProfileUrl(value: string): ProfileUrlAnalysis | null {
  const url = parseUrl(value)
  if (!url) return null

  const host = cleanHost(url.hostname)
  const platform = getPlatform(host)
  const segments = pathSegments(url)
  const first = segments[0] || ''
  const firstLower = first.toLowerCase()

  if (!platform) {
    return {
      platform: '网站',
      kind: 'website',
      original_url: formatUrl(url),
      canonical_profile_url: formatUrl(url),
      identity: null,
      site_host: host,
    }
  }

  if (platform === 'YouTube') {
    if (host === 'youtu.be' || ['watch', 'shorts', 'live', 'clip'].includes(firstLower)) {
      return socialAnalysis(url, platform, 'content', null, null)
    }
    if (first.startsWith('@')) {
      const handle = first.slice(1)
      return socialAnalysis(url, platform, 'profile', `/@${handle}`, `youtube:@${handle.toLowerCase()}`, handle)
    }
    if (['channel', 'c', 'user'].includes(firstLower) && segments[1]) {
      const identifier = segments[1]
      return socialAnalysis(
        url,
        platform,
        'profile',
        `/${firstLower}/${identifier}`,
        `youtube:${firstLower}:${identifier.toLowerCase()}`,
        firstLower === 'c' || firstLower === 'user' ? identifier : undefined
      )
    }
    return socialAnalysis(url, platform, 'content', null, null)
  }

  if (platform === 'TikTok') {
    if (first.startsWith('@')) {
      const handle = first.slice(1)
      const kind = segments[1]?.toLowerCase() === 'video' ? 'content' : 'profile'
      return socialAnalysis(url, platform, kind, `/@${handle}`, `tiktok:@${handle.toLowerCase()}`, handle)
    }
    return socialAnalysis(url, platform, 'content', null, null)
  }

  if (platform === 'Instagram') {
    if (!first || instagramContentPaths.has(firstLower)) {
      return socialAnalysis(url, platform, 'content', null, null)
    }
    return socialAnalysis(url, platform, 'profile', `/${first}`, `instagram:${firstLower}`, first)
  }

  if (platform === 'X') {
    if (!first || xReservedPaths.has(firstLower)) {
      return socialAnalysis(url, platform, 'content', null, null)
    }
    const kind = segments[1]?.toLowerCase() === 'status' ? 'content' : 'profile'
    return socialAnalysis(url, platform, kind, `/${first}`, `x:${firstLower}`, first)
  }

  if (first.startsWith('@')) {
    const handle = first.slice(1)
    return socialAnalysis(url, platform, 'profile', `/@${handle}`, `${platform.toLowerCase()}:@${handle.toLowerCase()}`, handle)
  }

  return socialAnalysis(url, platform, 'content', null, null)
}

export function inferKolProfileFromUrl(value: string): InferredKolProfile | null {
  const analysis = analyzeKolProfileUrl(value)
  if (!analysis || analysis.platform === '网站' || !analysis.canonical_profile_url) return null

  return {
    platform: analysis.platform,
    homepage_url: analysis.canonical_profile_url,
    ...(analysis.name ? { name: analysis.name } : {}),
  }
}

export function getProfileIdentity(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  return analyzeKolProfileUrl(value)?.identity || null
}

export function getWebsiteHost(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const analysis = analyzeKolProfileUrl(value)
  return analysis?.kind === 'website' ? analysis.site_host : null
}

export function isUnresolvedContentUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  const analysis = analyzeKolProfileUrl(value)
  return analysis?.kind === 'content' && !analysis.canonical_profile_url
}

export function normalizeProfileUrl(value: string): string {
  const url = parseUrl(value)
  if (!url) {
    return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
  }

  const analysis = analyzeKolProfileUrl(value)
  if (analysis?.canonical_profile_url && analysis.kind !== 'website') {
    const canonical = parseUrl(analysis.canonical_profile_url)
    if (canonical) return `${cleanHost(canonical.hostname)}${cleanPath(canonical.pathname).toLowerCase()}`
  }

  const host = cleanHost(url.hostname)
  const path = cleanPath(url.pathname).toLowerCase()
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !key.toLowerCase().startsWith('utm_') && !trackingParams.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
  const query = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : ''
  return `${host}${path}${query}`
}

export function toSafeExternalUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
  const candidate = trimmed.startsWith('//')
    ? `https:${trimmed}`
    : hasScheme
      ? trimmed
      : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    if (!url.hostname.includes('.') || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

export function toExternalProfileUrl(value: string | null | undefined): string | null {
  return toSafeExternalUrl(value)
}
