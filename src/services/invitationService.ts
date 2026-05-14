import { getSupabase } from '../lib/supabase'
import type { Invitation } from '../types'

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
  const { data, error } = await getSupabase()
    .from('invitations')
    .select('*')
    .eq('kol_id', kolId)
    .order('invited_at', { ascending: false })

  if (error) throw error
  return data as Invitation[]
}

export async function createInvitation(inv: Omit<Invitation, 'id'>): Promise<Invitation> {
  const { data, error } = await getSupabase()
    .from('invitations')
    .insert([normalizeInvitationPayload(inv)])
    .select()
    .single()

  if (error) throw error
  return data as Invitation
}

export async function deleteInvitation(id: string): Promise<void> {
  const { error } = await getSupabase().from('invitations').delete().eq('id', id)
  if (error) throw error
}

export async function updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation> {
  const { data, error } = await getSupabase()
    .from('invitations')
    .update(normalizeInvitationPayload(updates))
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Invitation
}
