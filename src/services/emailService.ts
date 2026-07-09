import { getSupabase } from '../lib/supabase'
import type { Email } from '../types'
import { retryOperation } from '../utils/retry'
import { logError } from '../utils/logger'

export async function getEmailsByKOL(kolId: string): Promise<Email[]> {
  try {
    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('emails')
          .select('*')
          .eq('kol_id', kolId)
          .order('sent_at', { ascending: false })

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Email[]
  } catch (error) {
    logError('getEmailsByKOL', error, { kolId })
    throw error
  }
}

export async function createEmail(email: Omit<Email, 'id'>): Promise<Email> {
  try {
    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('emails')
          .insert([email])
          .select()
          .single()

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Email
  } catch (error) {
    logError('createEmail', error, { email })
    throw error
  }
}
