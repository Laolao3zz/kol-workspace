import { getSupabase } from '../lib/supabase'
import type { Collaboration } from '../types'

export async function getCollaborations(): Promise<Collaboration[]> {
  const { data, error } = await getSupabase()
    .from('collaborations')
    .select('*')
    .order('cooperation_date', { ascending: false })

  if (error) throw error
  return data as Collaboration[]
}

export async function getCollaborationsByKOL(kolId: string): Promise<Collaboration[]> {
  const { data, error } = await getSupabase()
    .from('collaborations')
    .select('*')
    .eq('kol_id', kolId)
    .order('cooperation_date', { ascending: false })

  if (error) throw error
  return data as Collaboration[]
}

export async function createCollaboration(
  collab: Omit<Collaboration, 'id'>
): Promise<Collaboration> {
  const { data, error } = await getSupabase()
    .from('collaborations')
    .insert([collab])
    .select()
    .single()

  if (error) throw error
  return data as Collaboration
}

export async function updateCollaboration(
  id: string,
  updates: Partial<Collaboration>
): Promise<Collaboration> {
  const { id: _id, ...safeUpdates } = updates

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
