import { getSupabase, isDemoMode } from '../lib/supabase'
import type { KOL } from '../types'
import { demoDatabase } from './demoDatabase'
import { retryOperation } from '../utils/retry'
import { logError, logWarning } from '../utils/logger'
import { findKolDuplicateMatches, hasBlockingKolDuplicate } from '../utils/kolDuplicate'
import { analyzeKolProfileUrl, isUnresolvedContentUrl } from '../utils/profileUrl'

export async function getKOLs(): Promise<KOL[]> {
  try {
    if (isDemoMode()) {
      return demoDatabase.getKOLs()
    }

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

    if (isUnresolvedContentUrl(kol.homepage_url)) {
      throw new Error('主页链接是无法识别作者的内容页面，请改为 KOL 主页或频道链接')
    }

    const profileAnalysis = kol.homepage_url ? analyzeKolProfileUrl(kol.homepage_url) : null
    const payload = {
      ...kol,
      name: kol.name.trim(),
      email: kol.email?.trim() || '',
      homepage_url: profileAnalysis?.canonical_profile_url || kol.homepage_url?.trim() || '',
    }
    const duplicateMatches = findKolDuplicateMatches(payload, await getKOLs())
    const blockingMatches = duplicateMatches.filter(match => match.level === 'blocking')
    if (hasBlockingKolDuplicate(blockingMatches)) {
      const names = blockingMatches.slice(0, 3).map(match => match.kol.name).join('、')
      throw new Error(`检测到重复 KOL：${names}`)
    }

    if (isDemoMode()) {
      return demoDatabase.createKOL(payload)
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('kols')
          .insert([payload])
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

const KOL_UPDATE_FIELDS: Array<keyof KOL> = [
  'name',
  'email',
  'homepage_url',
  'platform',
  'followers',
  'country',
  'tags',
  'notes',
  'blacklisted_at',
  'blacklist_reason',
  'status',
]

export function sanitizeKOLUpdates(updates: Partial<KOL>): Partial<KOL> {
  return KOL_UPDATE_FIELDS.reduce<Partial<KOL>>((payload, field) => {
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
}

export async function updateKOL(
  id: string,
  updates: Partial<KOL>
): Promise<KOL> {
  try {
    const safeUpdates = sanitizeKOLUpdates(updates)

    if (Object.keys(safeUpdates).length === 0) {
      logWarning('updateKOL', '没有可保存的字段', { id, updates })
      throw new Error('没有可保存的 KOL 字段')
    }

    if (isDemoMode()) {
      return demoDatabase.updateKOL(id, safeUpdates)
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
    if (isDemoMode()) {
      demoDatabase.deleteKOL(id)
      return
    }

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
