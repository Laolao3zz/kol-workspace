import { getSupabase } from '../lib/supabase'
import type { KOL } from '../types'
import { retryOperation } from '../utils/retry'
import { logError, logWarning } from '../utils/logger'

export async function getKOLs(): Promise<KOL[]> {
  try {
    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('kols')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as KOL[]
  } catch (error) {
    logError('getKOLs', error)
    throw error
  }
}

export async function createKOL(
  kol: Partial<KOL> & Pick<KOL, 'name'>
): Promise<KOL> {
  try {
    // 数据验证
    if (!kol.name?.trim()) {
      throw new Error('KOL 名称不能为空')
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('kols')
          .insert([kol])
          .select()
          .single()

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as KOL
  } catch (error) {
    logError('createKOL', error, { kol })
    throw error
  }
}

export async function updateKOL(
  id: string,
  updates: Partial<KOL>
): Promise<KOL> {
  try {
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

    if (Object.keys(safeUpdates).length === 0) {
      logWarning('updateKOL', '没有可保存的字段', { id, updates })
      throw new Error('没有可保存的 KOL 字段')
    }

    // 添加 updated_at 时间戳
    const payload = {
      ...safeUpdates,
      updated_at: new Date().toISOString()
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('kols')
          .update(payload)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          throw new Error(`KOL 保存失败：${error.message}`)
        }
        return data
      },
      {
        maxRetries: 3,
        onRetry: (attempt) => {
          logWarning('updateKOL', `重试第 ${attempt} 次`, { id, updates })
        }
      }
    )

    return result as KOL
  } catch (error) {
    logError('updateKOL', error, { id, updates })
    throw error
  }
}

export async function deleteKOL(id: string): Promise<void> {
  try {
    await retryOperation(
      async () => {
        const { error } = await getSupabase()
          .from('kols')
          .delete()
          .eq('id', id)

        if (error) throw error
        return true
      },
      { maxRetries: 2 }
    )
  } catch (error) {
    logError('deleteKOL', error, { id })
    throw error
  }
}
