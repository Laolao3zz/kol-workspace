import type { KOL } from '../types'

type OutreachKol = Pick<KOL, 'id' | 'name' | 'email'>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function buildBatchOutreachSelection<T extends OutreachKol>(kols: T[]) {
  const validKols: T[] = []
  const missingEmailKols: T[] = []
  const recipients: string[] = []
  const seenEmails = new Set<string>()

  for (const kol of kols) {
    const email = kol.email?.trim() || ''
    if (!EMAIL_PATTERN.test(email)) {
      missingEmailKols.push(kol)
      continue
    }

    validKols.push(kol)
    const key = email.toLocaleLowerCase()
    if (!seenEmails.has(key)) {
      seenEmails.add(key)
      recipients.push(email)
    }
  }

  return {
    validKols,
    missingEmailKols,
    recipients,
    recipientText: recipients.join(', '),
  }
}
