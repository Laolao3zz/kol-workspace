import { getSupabase, isDemoMode } from '../lib/supabase'
import type { Product } from '../types'
import { retryOperation } from '../utils/retry'
import { logError, logWarning } from '../utils/logger'
import { demoDatabase } from './demoDatabase'

export type ProductInput = Omit<Product, 'id' | 'created_at' | 'updated_at'>
export interface ProductMergeInput {
  sourceProductId: string
  targetProductId: string
}

export interface ProductMergeResult {
  source: Product
  target: Product
}

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

function uniqueList(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>()
  const values: string[] = []

  lists.flatMap(list => list || []).forEach(item => {
    const value = String(item || '').trim()
    const key = value.toLocaleLowerCase()
    if (!value || seen.has(key)) return

    seen.add(key)
    values.push(value)
  })

  return values
}

function appendMergeNote(notes: string | undefined, targetName: string): string {
  return [notes?.trim(), `已合并到「${targetName}」。`].filter(Boolean).join('\n')
}

function mergedTargetPayload(source: Product, target: Product): Partial<Product> {
  return normalizeProductPayload({
    category: target.category || source.category || '',
    target_kol_tags: uniqueList(target.target_kol_tags, source.target_kol_tags),
    target_content_shapes: uniqueList(target.target_content_shapes, source.target_content_shapes),
    status: target.status || '在推',
    priority: Math.max(Number(target.priority || 0), Number(source.priority || 0)),
    notes: target.notes || '',
  })
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

async function getProductById(id: string): Promise<Product> {
  const product = (await getProducts()).find(item => item.id === id)
  if (!product) throw new Error('产品不存在或已被删除')
  return product
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

export async function mergeProducts(input: ProductMergeInput): Promise<ProductMergeResult> {
  try {
    const source = await getProductById(input.sourceProductId)
    const target = await getProductById(input.targetProductId)
    if (source.id === target.id) throw new Error('不能合并同一个产品')

    const targetPayload = mergedTargetPayload(source, target)

    if (isDemoMode()) {
      return demoDatabase.mergeProducts(source.id, target.id, targetPayload)
    }

    const supabase = getSupabase()
    const updatedAt = new Date().toISOString()
    const archivedSourcePayload = normalizeProductPayload({
      status: '归档',
      notes: appendMergeNote(source.notes, target.name),
    })

    await retryOperation(
      async () => {
        const updates = [
          supabase
            .from('products')
            .update({ ...targetPayload, updated_at: updatedAt })
            .eq('id', target.id)
            .select()
            .single(),
          supabase
            .from('products')
            .update({ ...archivedSourcePayload, updated_at: updatedAt })
            .eq('id', source.id)
            .select()
            .single(),
          supabase
            .from('kols')
            .update({ sample_product: target.name, updated_at: updatedAt })
            .eq('sample_product', source.name),
          supabase
            .from('invitations')
            .update({ product: target.name })
            .eq('product', source.name),
          supabase
            .from('shipments')
            .update({ product: target.name, updated_at: updatedAt })
            .eq('product', source.name),
          supabase
            .from('collaborations')
            .update({ product: target.name })
            .eq('product', source.name),
        ]
        const results = await Promise.all(updates)
        const failed = results.find(result => result.error)
        if (failed?.error) throw failed.error

        return true
      },
      { maxRetries: 2 }
    )

    const products = await getProducts()
    return {
      source: products.find(product => product.id === source.id) || { ...source, status: '归档', notes: archivedSourcePayload.notes || source.notes },
      target: products.find(product => product.id === target.id) || { ...target, ...targetPayload },
    }
  } catch (error) {
    logError('mergeProducts', error, input)
    throw error
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    if (isDemoMode()) {
      demoDatabase.deleteProduct(id)
      return
    }

    await retryOperation(
      async () => {
        const { error } = await getSupabase().from('products').delete().eq('id', id)
        if (error) throw error
        return true
      },
      { maxRetries: 2 }
    )
  } catch (error) {
    logError('deleteProduct', error, { id })
    throw error
  }
}
