import type { KOL } from '../types'
import { getProfileIdentity, getWebsiteHost, normalizeProfileUrl } from './profileUrl'

export interface KolDuplicateCandidate {
  name?: string | null
  email?: string | null
  homepage_url?: string | null
}

export interface KolDuplicateMatch {
  kol: KOL
  level: 'blocking' | 'warning'
  fields: string[]
}

const normalizeText = (value: string | null | undefined) =>
  String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ')

const normalizeEmail = (value: string | null | undefined) =>
  String(value || '').trim().toLocaleLowerCase()

export function findKolDuplicateMatches(
  candidate: KolDuplicateCandidate,
  existingKols: KOL[]
): KolDuplicateMatch[] {
  const name = normalizeText(candidate.name)
  const email = normalizeEmail(candidate.email)
  const homepage = candidate.homepage_url?.trim() || ''
  const normalizedHomepage = homepage ? normalizeProfileUrl(homepage) : ''
  const profileIdentity = getProfileIdentity(homepage)
  const websiteHost = getWebsiteHost(homepage)

  return existingKols.reduce<KolDuplicateMatch[]>((matches, kol) => {
    const blockingFields = new Set<string>()
    const warningFields = new Set<string>()
    const existingHomepage = kol.homepage_url?.trim() || ''

    if (email && normalizeEmail(kol.email) === email) blockingFields.add('邮箱')
    if (normalizedHomepage && existingHomepage && normalizeProfileUrl(existingHomepage) === normalizedHomepage) {
      blockingFields.add('主页链接')
    }
    if (profileIdentity && getProfileIdentity(existingHomepage) === profileIdentity) {
      blockingFields.add('平台账号')
    }
    if (name && normalizeText(kol.name) === name) warningFields.add('名称')
    if (
      websiteHost &&
      getWebsiteHost(existingHomepage) === websiteHost &&
      !blockingFields.has('主页链接')
    ) {
      warningFields.add('同一网站域名')
    }

    if (blockingFields.size > 0) {
      matches.push({ kol, level: 'blocking', fields: [...blockingFields, ...warningFields] })
    } else if (warningFields.size > 0) {
      matches.push({ kol, level: 'warning', fields: [...warningFields] })
    }
    return matches
  }, [])
}

export function hasBlockingKolDuplicate(matches: KolDuplicateMatch[]): boolean {
  return matches.some(match => match.level === 'blocking')
}
