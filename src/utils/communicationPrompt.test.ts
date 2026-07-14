import { describe, expect, it } from 'vitest'
import type { Email } from '../types'
import { buildCommunicationPrompt } from './communicationPrompt'

const email = (overrides: Partial<Email>): Email => ({
  id: overrides.id || 'email-1',
  kol_id: 'kol-1',
  kol_email: 'creator@example.com',
  direction: overrides.direction || 'inbound',
  from_address: overrides.from_address || 'creator@example.com',
  to_address: overrides.to_address || 'team@example.com',
  subject: overrides.subject || 'Review',
  body: overrides.body || 'Hello',
  sent_at: overrides.sent_at || '2026-07-01T10:00:00.000Z',
  message_id: overrides.message_id || overrides.id || 'message-1',
})

describe('communication prompt', () => {
  it('orders email history from oldest to newest and identifies direction', () => {
    const prompt = buildCommunicationPrompt({
      kolName: 'Tech Creator',
      kolEmail: 'creator@example.com',
      emails: [
        email({ id: 'new', subject: 'Second', direction: 'inbound', sent_at: '2026-07-02T10:00:00.000Z' }),
        email({ id: 'old', subject: 'First', direction: 'outbound', sent_at: '2026-07-01T10:00:00.000Z' }),
      ],
    })

    expect(prompt.indexOf('主题：First')).toBeLessThan(prompt.indexOf('主题：Second'))
    expect(prompt).toContain('方向：我方发出')
    expect(prompt).toContain('方向：KOL 发来')
  })

  it('normalizes excessive whitespace without dropping body content', () => {
    const prompt = buildCommunicationPrompt({
      kolName: 'Creator',
      kolEmail: 'creator@example.com',
      emails: [email({ body: 'Line one  \n\n\nLine two' })],
    })

    expect(prompt).toContain('Line one\n\nLine two')
    expect(prompt).toContain('不要编造邮件中没有的信息')
  })
})
