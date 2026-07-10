import { getSupabase, isDemoMode } from '../lib/supabase'
import type { Product } from '../types'
import { retryOperation } from '../utils/retry'
import { logError, logWarning } from '../utils/logger'
import { demoDatabase } from './demoDatabase'
import { countProductDeletionReferences } from '../utils/productCorrection'

export type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at'>

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(item => String(item || '').trim()).filter(Boolean)
}

function normalizeProductPayload(product: Partial<Product>): Partial<Product> {
  const payload: Partial<Product> = {}

  if ('name' in product) payload.name = product.name?.trim() || ''
  if ('category' in product) payload.category = product.category?.trim() || ''
  if ('target_kol_tags' in product) payload.target_kol_tags = normalizeStringArray(product.target_kol_tags)
  if ('target_content_shapes' in product) payload.target_content_shapes = normalizeStringArray(product.target_content_shapes)
  if ('status' in product) payload.status = product.status || '在推'
  if ('priority' in product) payload.priority = Number.isFinite(Number(product.priority)) ? Number(product.priority) : 0
  if ('notes' in product) payload.notes = product.notes?.trim() || ''

  return payload
}


export async function getProducts(): Promise<Product[]> {
  try {
    if (isDemoMode()) {
      return demoDatabase.getProducts()
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('products')
          .select('*')
          .order('priority', { ascending: false })
          .order('name', { ascending: true })

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Product[]
  } catch (error) {
    logError('getProducts', error)
    throw error
  }
}

export async function createProduct(product: ProductInput): Promise<Product> {
  try {
    const payload = normalizeProductPayload(product)
    if (!payload.name) throw new Error('产品名称不能为空')

    if (isDemoMode()) {
      return demoDatabase.createProduct(payload as Partial<Product> & Pick<Product, 'name'>)
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('products')
          .insert([payload])
          .select()
          .single()

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Product
  } catch (error) {
    logError('createProduct', error, { product })
    throw error
  }
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  try {
    const payload = normalizeProductPayload(updates)
    if (Object.keys(payload).length === 0) {
      logWarning('updateProduct', '没有可保存的字段', { id, updates })
      throw new Error('没有可保存的产品字段')
    }

    if (isDemoMode()) {
      return demoDatabase.updateProduct(id, payload)
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('products')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Product
  } catch (error) {
    logError('updateProduct', error, { id, updates })
    throw error
  }
}

export async function deleteProduct(product: Pick<Product, 'id' | 'name'>): Promise<void> {
  try {
    if (isDemoMode()) {
      const references = countProductDeletionReferences(product, demoDatabase.getProducts(), {
        invitations: demoDatabase.getInvitations(),
        shipments: demoDatabase.getShipments(),
        collaborations: demoDatabase.getCollaborations(),
      })
      if (references.total > 0) {
        throw new Error(`产品「${product.name}」仍有 ${references.total} 条业务记录引用，请先在 KOL 档案中修正产品`)
      }
      demoDatabase.deleteProduct(product.id)
      return
    }

    const deletion = await retryOperation(
      async () => {
        const { data, error } = await getSupabase().rpc('delete_product_if_unreferenced', {
          p_product_id: product.id,
        })
        if (error) {
          if (error.code === 'PGRST202' || error.code === '42883') {
            throw new Error('永久删除功能需要先运行最新的 supabase-patch.sql 数据库补丁')
          }
          throw error
        }
        return data as {
          deleted: boolean
          reference_count?: number
          invitation_count?: number
          shipment_count?: number
          collaboration_count?: number
        }
      },
      { maxRetries: 2 }
    )

    if (!deletion.deleted) {
      throw new Error(`产品「${product.name}」仍有 ${deletion.reference_count || 0} 条业务记录引用，请先在 KOL 档案中修正产品`)
    }
  } catch (error) {
    logError('deleteProduct', error, { id: product.id, name: product.name })
    throw error
  }
}
