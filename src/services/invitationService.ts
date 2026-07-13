import { getSupabase, isDemoMode } from '../lib/supabase'
import type { Invitation } from '../types'
import { demoDatabase } from './demoDatabase'
import { retryOperation } from '../utils/retry'
import { logError } from '../utils/logger'
import { collectAllPages } from '../utils/pagination'
import { isAutoCreatedPendingShipment } from '../utils/invitationWorkflow'

const nullableDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return value == null ? null : String(value)
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeInvitationPayload(invitation: Partial<Invitation>): Partial<Invitation> {
  const payload: Partial<Invitation> = {}

  if ('kol_id' in invitation) payload.kol_id = invitation.kol_id
  if ('product' in invitation) payload.product = invitation.product?.trim() || ''
  if ('invited_at' in invitation) payload.invited_at = nullableDate(invitation.invited_at) || ''
  if ('email_subject' in invitation) payload.email_subject = invitation.email_subject?.trim() || ''
  if ('replied' in invitation) payload.replied = Boolean(invitation.replied)
  if ('reply_result' in invitation) payload.reply_result = invitation.reply_result || '未回复'
  if ('quoted_fee' in invitation) payload.quoted_fee = invitation.quoted_fee?.trim() || ''
  if ('decision' in invitation) payload.decision = invitation.decision || '待评估'
  if ('decision_reason' in invitation) payload.decision_reason = invitation.decision_reason?.trim() || ''
  if ('notes' in invitation) payload.notes = invitation.notes?.trim() || ''

  return payload
}

export async function getInvitationsByKOL(kolId: string): Promise<Invitation[]> {
  try {
    if (isDemoMode()) {
      return demoDatabase.getInvitationsByKOL(kolId)
    }

    const result = await retryOperation(
      async () => collectAllPages(async (from, to) => {
        const { data, error } = await getSupabase()
          .from('invitations')
          .select('*')
          .eq('kol_id', kolId)
          .order('invited_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)

        if (error) throw error
        return data || []
      }),
      { maxRetries: 2 }
    )

    return result as Invitation[]
  } catch (error) {
    logError('getInvitationsByKOL', error, { kolId })
    throw error
  }
}

export async function createInvitation(inv: Omit<Invitation, 'id'>): Promise<Invitation> {
  try {
    const payload = normalizeInvitationPayload(inv)

    if (isDemoMode()) {
      return demoDatabase.createInvitation(payload as Partial<Invitation> & Pick<Invitation, 'kol_id' | 'product'>)
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('invitations')
          .insert([payload])
          .select()
          .single()

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Invitation
  } catch (error) {
    logError('createInvitation', error, { inv })
    throw error
  }
}

export async function deleteInvitation(id: string): Promise<void> {
  try {
    if (isDemoMode()) {
      const linkedShipments = demoDatabase.getShipments()
        .filter(shipment => shipment.source_invitation_id === id)
      linkedShipments.forEach(shipment => {
        if (isAutoCreatedPendingShipment(shipment)) {
          demoDatabase.deleteShipment(shipment.id)
        } else {
          demoDatabase.updateShipment(shipment.id, { source_invitation_id: null })
        }
      })
      demoDatabase.deleteInvitation(id)
      return
    }

    await retryOperation(
      async () => {
        const { error } = await getSupabase().rpc('delete_invitation_with_stale_shipment', {
          p_invitation_id: id,
        })
        if (error) throw error
        return true
      },
      { maxRetries: 2 }
    )
  } catch (error) {
    logError('deleteInvitation', error, { id })
    throw error
  }
}

export async function updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation> {
  try {
    const payload = normalizeInvitationPayload(updates)

    if (isDemoMode()) {
      return demoDatabase.updateInvitation(id, payload)
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('invitations')
          .update(payload)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Invitation
  } catch (error) {
    logError('updateInvitation', error, { id, updates })
    throw error
  }
}
