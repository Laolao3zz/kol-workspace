export interface InferredKolProfile {
  platform: string
  homepage_url: string
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

function formatHomepageUrl(url: URL): string {
  return `${url.protocol}//${url.hostname}${cleanPath(url.pathname)}`
}

function getPlatform(host: string): string | null {
  return platformByHost.find(item => item.pattern.test(host))?.platform || null
}

function firstPathSegment(url: URL): string {
  return cleanPath(url.pathname).split('/').filter(Boolean)[0] || ''
}

function getHandleName(url: URL, platform: string): string | undefined {
  const segment = firstPathSegment(url)
  if (!segment) return undefined
  if (platform === 'YouTube') {
    if (segment.startsWith('@')) return segment.slice(1)
    return undefined
  }
  if (segment.startsWith('@')) return segment.slice(1)
  if (['watch', 'video', 'reel', 'p', 'shorts', 'channel', 'c', 'user'].includes(segment.toLowerCase())) {
    return undefined
  }
  return decodeURIComponent(segment)
}

export function inferKolProfileFromUrl(value: string): InferredKolProfile | null {
  const url = parseUrl(value)
  if (!url) return null
  const host = cleanHost(url.hostname)
  const platform = getPlatform(host)
  if (!platform) return null

  const name = getHandleName(url, platform)
  return {
    platform,
    homepage_url: formatHomepageUrl(url),
    ...(name ? { name } : {}),
  }
}

export function normalizeProfileUrl(value: string): string {
  const url = parseUrl(value)
  if (!url) {
    return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
  }

  const host = cleanHost(url.hostname)
  const path = cleanPath(url.pathname).toLowerCase()
  return `${host}${path}`
}
