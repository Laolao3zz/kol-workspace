import { getSupabase } from '../lib/supabase'
import type { Invitation } from '../types'

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
    .insert([inv])
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
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Invitation
}
