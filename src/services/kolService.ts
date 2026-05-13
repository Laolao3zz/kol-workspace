import { getSupabase } from '../lib/supabase'
import type { KOL } from '../types'

export async function getKOLs(): Promise<KOL[]> {
  const { data, error } = await getSupabase()
    .from('kols')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as KOL[]
}

export async function createKOL(
  kol: Partial<KOL> & Pick<KOL, 'name'>
): Promise<KOL> {
  const { data, error } = await getSupabase()
    .from('kols')
    .insert([kol])
    .select()
    .single()

  if (error) throw error
  return data as KOL
}

export async function updateKOL(
  id: string,
  updates: Partial<KOL>
): Promise<KOL> {
  const { data, error } = await getSupabase()
    .from('kols')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as KOL
}

export async function deleteKOL(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('kols')
    .delete()
    .eq('id', id)

  if (error) throw error
}
