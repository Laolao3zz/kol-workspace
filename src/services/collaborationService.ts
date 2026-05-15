import { getSupabase } from '../lib/supabase'
import type { Collaboration } from '../types'

const nullableDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return value == null ? null : String(value)
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const numberOrZero = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeCollaborationPayload(
  collab: Partial<Collaboration>
): Partial<Collaboration> {
  const payload: Partial<Collaboration> = {}

  if ('kol_id' in collab) payload.kol_id = collab.kol_id
  if ('product' in collab) payload.product = collab.product?.trim() || ''
  if ('publish_date' in collab) payload.publish_date = nullableDate(collab.publish_date)
  if ('work_url' in collab) payload.work_url = collab.work_url?.trim() || ''
  if ('views' in collab) payload.views = numberOrZero(collab.views)
  if ('comments' in collab) payload.comments = numberOrZero(collab.comments)
  if ('likes' in collab) payload.likes = numberOrZero(collab.likes)
  if ('fee' in collab) payload.fee = collab.fee?.trim() || ''
  if ('notes' in collab) payload.notes = collab.notes?.trim() || ''

  return payload
}

export async function getCollaborations(): Promise<Collaboration[]> {
  const { data, error } = await getSupabase()
    .from('collaborations')
    .select('*')
    .order('publish_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Collaboration[]
}

export async function getCollaborationsByKOL(kolId: string): Promise<Collaboration[]> {
  const { data, error } = await getSupabase()
    .from('collaborations')
    .select('*')
    .eq('kol_id', kolId)
    .order('publish_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Collaboration[]
}

export async function createCollaboration(
  collab: Omit<Collaboration, 'id'>
): Promise<Collaboration> {
  const { data, error } = await getSupabase()
    .from('collaborations')
    .insert([normalizeCollaborationPayload(collab)])
    .select()
    .single()

  if (error) throw error
  return data as Collaboration
}

export async function updateCollaboration(
  id: string,
  updates: Partial<Collaboration>
): Promise<Collaboration> {
  const safeUpdates = normalizeCollaborationPayload(updates)

  const { data, error } = await getSupabase()
    .from('collaborations')
    .update(safeUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Collaboration
}

export async function deleteCollaboration(id: string): Promise<void> {
  const { error } = await getSupabase().from('collaborations').delete().eq('id', id)
  if (error) throw error
}
