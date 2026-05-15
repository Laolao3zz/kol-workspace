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
  const allowedFields: Array<keyof KOL> = [
    'name',
    'email',
    'homepage_url',
    'platform',
    'followers',
    'country',
    'tags',
    'status',
    'sample_date',
    'tracking_number',
    'shipping_details',
  ]

  const safeUpdates = allowedFields.reduce<Partial<KOL>>((payload, field) => {
    if (!(field in updates)) return payload

    const value = updates[field]
    if (field === 'tags') {
      payload.tags = Array.isArray(value) ? value : []
      return payload
    }

    if (value !== undefined) {
      payload[field] = value as never
    }
    return payload
  }, {})

  const { data, error } = await getSupabase()
    .from('kols')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
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
