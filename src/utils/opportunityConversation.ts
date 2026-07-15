import type { Invitation, InvitationDirection } from '../types'
import { invitationTimelineKey } from './kolStatus'

export interface OpportunityConversation {
  id: string
  direction: InvitationDirection
  invitations: Invitation[]
  latest: Invitation
}

export function getInvitationDirection(invitation: Pick<Invitation, 'direction'>): InvitationDirection {
  return invitation.direction === 'inbound' ? 'inbound' : 'outbound'
}

export function createConversationId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function groupOpportunityConversations(invitations: Invitation[]): OpportunityConversation[] {
  const groups = new Map<string, Invitation[]>()

  invitations.forEach(invitation => {
    const conversationId = invitation.conversation_id?.trim() || invitation.id
    const group = groups.get(conversationId) || []
    group.push(invitation)
    groups.set(conversationId, group)
  })

  return [...groups.entries()]
    .map(([id, groupedInvitations]) => {
      const sorted = [...groupedInvitations].sort((left, right) =>
        invitationTimelineKey(right).localeCompare(invitationTimelineKey(left)) || left.product.localeCompare(right.product)
      )
      return {
        id,
        direction: getInvitationDirection(sorted[0]),
        invitations: sorted,
        latest: sorted[0],
      }
    })
    .sort((left, right) => invitationTimelineKey(right.latest).localeCompare(invitationTimelineKey(left.latest)))
}

export function getConversationProductLabel(invitation: Invitation, invitations: Invitation[]): string {
  const conversationId = invitation.conversation_id?.trim()
  if (!conversationId) return invitation.product

  const products = invitations
    .filter(item => item.conversation_id?.trim() === conversationId)
    .map(item => item.product.trim())
    .filter(Boolean)

  return [...new Set(products)].join('、') || invitation.product
}
