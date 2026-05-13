import { getSupabase } from '../lib/supabase'
import type { Email } from '../types'

export async function getEmailsByKOL(kolId: string): Promise<Email[]> {
  const { data, error } = await getSupabase()
    .from('emails')
    .select('*')
    .eq('kol_id', kolId)
    .order('sent_at', { ascending: false })

  if (error) throw error
  return data as Email[]
}

export async function createEmail(email: Omit<Email, 'id'>): Promise<Email> {
  const { data, error } = await getSupabase()
    .from('emails')
    .insert([email])
    .select()
    .single()

  if (error) throw error
  return data as Email
}
