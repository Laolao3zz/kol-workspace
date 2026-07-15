import { describe, expect, it } from 'vitest'
import type { Invitation } from '../types'
import { createConversationId, getConversationProductLabel, getInvitationDirection, groupOpportunityConversations } from './opportunityConversation'

const invitation = (overrides: Partial<Invitation>): Invitation => ({
  id: overrides.id || 'inv-1',
  kol_id: 'kol-1',
  product: overrides.product || 'K1',
  invited_at: '2026-07-15',
  email_subject: '',
  replied: false,
  reply_result: '未回复',
  quoted_fee: '',
  decision: '待评估',
  decision_reason: '',
  notes: '',
  ...overrides,
})

describe('opportunity conversations', () => {
  it('groups multiple products from the same contact event', () => {
    const grouped = groupOpportunityConversations([
      invitation({ id: 'k1', product: 'K1', conversation_id: 'conversation-1' }),
      invitation({ id: 'x1', product: 'X1', conversation_id: 'conversation-1' }),
      invitation({ id: 'later', product: 'R1', conversation_id: 'conversation-2', invited_at: '2026-07-16' }),
    ])

    expect(grouped).toHaveLength(2)
    expect(grouped[0].id).toBe('conversation-2')
    expect(grouped[1].invitations.map(item => item.product)).toEqual(['K1', 'X1'])
  })

  it('keeps legacy records without a conversation id separate', () => {
    const grouped = groupOpportunityConversations([
      invitation({ id: 'legacy-1' }),
      invitation({ id: 'legacy-2' }),
    ])

    expect(grouped.map(item => item.id)).toEqual(['legacy-1', 'legacy-2'])
  })

  it('treats legacy direction as outbound', () => {
    expect(getInvitationDirection(invitation({ direction: undefined }))).toBe('outbound')
    expect(getInvitationDirection(invitation({ direction: 'inbound' }))).toBe('inbound')
  })

  it('creates UUID-shaped conversation ids', () => {
    expect(createConversationId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('builds a product label for a multi-product conversation', () => {
    const items = [
      invitation({ id: 'k1', product: 'K1', conversation_id: 'conversation-1' }),
      invitation({ id: 'x1', product: 'X1', conversation_id: 'conversation-1' }),
    ]
    expect(getConversationProductLabel(items[0], items)).toBe('K1、X1')
  })
})
