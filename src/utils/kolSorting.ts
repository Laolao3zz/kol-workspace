import type { Collaboration, Invitation, KOL } from '../types'
import { countCompletedCollaborations, getLatestInvitation, invitationTimelineKey } from './kolStatus'

export type KolSortOption =
  | 'created_desc'
  | 'updated_desc'
  | 'name_asc'
  | 'followers_desc'
  | 'invitation_desc'
  | 'collaborations_desc'

export function parseFollowerCount(value: string): number {
  const normalized = String(value || '').trim().toLowerCase().replace(/,/g, '')
  const match = normalized.match(/([\d.]+)\s*([kmb万亿]?)/)
  if (!match) return 0

  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return 0

  const multiplier: Record<string, number> = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
    万: 10_000,
    亿: 100_000_000,
  }
  return amount * (multiplier[match[2]] || 1)
}

export function sortKols(
  kols: KOL[],
  option: KolSortOption,
  invitations: Record<string, Invitation[]>,
  collaborationsByKol: Record<string, Collaboration[]>
): KOL[] {
  const compareName = (a: KOL, b: KOL) => a.name.localeCompare(b.name)
  const latestInvitationKey = (kol: KOL) => {
    const latest = getLatestInvitation(invitations[kol.id] || [])
    return latest ? invitationTimelineKey(latest) : ''
  }

  return [...kols].sort((a, b) => {
    if (option === 'name_asc') return compareName(a, b)
    if (option === 'followers_desc') {
      return parseFollowerCount(b.followers) - parseFollowerCount(a.followers) || compareName(a, b)
    }
    if (option === 'invitation_desc') {
      return latestInvitationKey(b).localeCompare(latestInvitationKey(a)) || compareName(a, b)
    }
    if (option === 'collaborations_desc') {
      const aCount = countCompletedCollaborations(collaborationsByKol[a.id] || [])
      const bCount = countCompletedCollaborations(collaborationsByKol[b.id] || [])
      return bCount - aCount || compareName(a, b)
    }
    if (option === 'updated_desc') {
      return String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || compareName(a, b)
    }
    return String(b.created_at || '').localeCompare(String(a.created_at || '')) || compareName(a, b)
  })
}
