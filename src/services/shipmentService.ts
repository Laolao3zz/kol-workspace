import { getSupabase, isDemoMode } from '../lib/supabase'
import type { Shipment } from '../types'
import { demoDatabase } from './demoDatabase'
import { retryOperation } from '../utils/retry'
import { logError, logWarning } from '../utils/logger'
import { collectAllPages } from '../utils/pagination'
import { AUTO_CREATED_SHIPMENT_NOTE, isAutoCreatedPendingShipment } from '../utils/invitationWorkflow'

export type ShipmentInput = Omit<Shipment, 'id' | 'created_at' | 'updated_at'>

const nullableDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return value == null ? null : String(value)
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function validateShipment(shipment: Partial<Shipment>): string[] {
  const errors: string[] = []

  if ('product' in shipment && !shipment.product?.trim()) {
    errors.push('产品名称不能为空')
  }

  if (shipment.status === '运输中' && !shipment.tracking_number?.trim()) {
    errors.push('运输中状态必须填写快递单号')
  }

  if (shipment.status === '已签收' && !shipment.delivered_at) {
    errors.push('已签收状态必须填写签收日期')
  }

  if (shipment.completed_at && !shipment.progress_status) {
    errors.push('完成状态必须选择内容进度')
  }

  return errors
}

function normalizeShipmentPayload(shipment: Partial<Shipment>): Partial<Shipment> {
  const payload: Partial<Shipment> = {}

  if ('kol_id' in shipment) payload.kol_id = shipment.kol_id
  if ('source_invitation_id' in shipment) payload.source_invitation_id = shipment.source_invitation_id?.trim() || null
  if ('product' in shipment) payload.product = shipment.product?.trim() || ''
  if ('sample_date' in shipment) payload.sample_date = nullableDate(shipment.sample_date)
  if ('tracking_number' in shipment) payload.tracking_number = shipment.tracking_number?.trim() || ''
  if ('shipping_details' in shipment) payload.shipping_details = shipment.shipping_details?.trim() || ''
  if ('status' in shipment) payload.status = shipment.status || '待寄出'
  if ('notes' in shipment) payload.notes = shipment.notes?.trim() || ''
  if ('delivered_at' in shipment) payload.delivered_at = nullableDate(shipment.delivered_at)
  if ('progress_status' in shipment) payload.progress_status = shipment.progress_status || '待制作'
  if ('progress_notes' in shipment) payload.progress_notes = shipment.progress_notes?.trim() || ''
  if ('expected_publish_date' in shipment) payload.expected_publish_date = nullableDate(shipment.expected_publish_date)
  if ('completed_at' in shipment) payload.completed_at = nullableDate(shipment.completed_at)
  if ('archived_at' in shipment) payload.archived_at = nullableDate(shipment.archived_at)

  return payload
}

async function getShipmentBySourceInvitation(sourceInvitationId: string): Promise<Shipment | null> {
  const { data, error } = await getSupabase()
    .from('shipments')
    .select('*')
    .eq('source_invitation_id', sourceInvitationId)
    .maybeSingle()

  if (error) throw error
  return data as Shipment | null
}

export async function getShipments(): Promise<Shipment[]> {
  try {
    if (isDemoMode()) {
      return demoDatabase.getShipments()
    }

    const result = await retryOperation(
      async () => collectAllPages(async (from, to) => {
        const { data, error } = await getSupabase()
          .from('shipments')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)

        if (error) throw error
        return data || []
      }),
      { maxRetries: 2 }
    )

    return result as Shipment[]
  } catch (error) {
    logError('getShipments', error)
    throw error
  }
}

export async function getShipmentsByKOL(kolId: string): Promise<Shipment[]> {
  try {
    if (isDemoMode()) {
      return demoDatabase.getShipmentsByKOL(kolId)
    }

    const result = await retryOperation(
      async () => collectAllPages(async (from, to) => {
        const { data, error } = await getSupabase()
          .from('shipments')
          .select('*')
          .eq('kol_id', kolId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)

        if (error) throw error
        return data || []
      }),
      { maxRetries: 2 }
    )

    return result as Shipment[]
  } catch (error) {
    logError('getShipmentsByKOL', error, { kolId })
    throw error
  }
}

export async function createShipment(shipment: ShipmentInput): Promise<Shipment> {
  try {
    // 验证数据
    const errors = validateShipment(shipment)
    if (errors.length > 0) {
      throw new Error(`数据验证失败：${errors.join(', ')}`)
    }

    const payload = normalizeShipmentPayload(shipment)

    const sourceInvitationId = payload.source_invitation_id?.trim()

    if (isDemoMode()) {
      if (sourceInvitationId) {
        const existing = demoDatabase.getShipmentsByKOL(shipment.kol_id)
          .find(candidate => candidate.source_invitation_id === sourceInvitationId)
        if (existing) return existing
      }
      return demoDatabase.createShipment(payload as Partial<Shipment> & Pick<Shipment, 'kol_id' | 'product'>)
    }

    if (sourceInvitationId) {
      const existing = await getShipmentBySourceInvitation(sourceInvitationId)
      if (existing) return existing

      const { data, error } = await getSupabase()
        .from('shipments')
        .insert([payload])
        .select()
        .single()

      if (!error) return data as Shipment

      try {
        const recovered = await getShipmentBySourceInvitation(sourceInvitationId)
        if (recovered) return recovered
      } catch {
        // Preserve the insert error because it is the operation the caller requested.
      }
      throw error
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('shipments')
          .insert([payload])
          .select()
          .single()

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Shipment
  } catch (error) {
    logError('createShipment', error, { shipment })
    throw error
  }
}

export async function deleteAutoCreatedPendingShipment(expected: Shipment): Promise<boolean> {
  try {
    if (!isAutoCreatedPendingShipment(expected)) return false

    if (isDemoMode()) {
      const current = demoDatabase.getShipmentsByKOL(expected.kol_id)
        .find(shipment => shipment.id === expected.id)
      if (!current || current.source_invitation_id !== expected.source_invitation_id || !isAutoCreatedPendingShipment(current)) {
        return false
      }
      demoDatabase.deleteShipment(current.id)
      return true
    }

    let query = getSupabase()
      .from('shipments')
      .delete()
      .eq('id', expected.id)
      .eq('status', '待寄出')
      .eq('notes', AUTO_CREATED_SHIPMENT_NOTE)
      .is('sample_date', null)
      .is('archived_at', null)
      .or('tracking_number.is.null,tracking_number.eq.')

    query = expected.source_invitation_id?.trim()
      ? query.eq('source_invitation_id', expected.source_invitation_id)
      : query.is('source_invitation_id', null)

    const { data, error } = await query.select('id')
    if (error) throw error
    return Boolean(data?.length)
  } catch (error) {
    logError('deleteAutoCreatedPendingShipment', error, { shipmentId: expected.id })
    throw error
  }
}

export async function updateShipment(
  id: string,
  updates: Partial<Shipment>
): Promise<Shipment> {
  try {
    // 验证数据
    const errors = validateShipment(updates)
    if (errors.length > 0) {
      logWarning('updateShipment', '数据验证警告', { errors, updates })
      throw new Error(`数据验证失败：${errors.join(', ')}`)
    }

    const safeUpdates = normalizeShipmentPayload(updates)

    if (isDemoMode()) {
      return demoDatabase.updateShipment(id, safeUpdates)
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('shipments')
          .update({ ...safeUpdates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        return data
      },
      {
        maxRetries: 3,
        onRetry: (attempt) => {
          logWarning('updateShipment', `重试第 ${attempt} 次`, { id, updates })
        }
      }
    )

    return result as Shipment
  } catch (error) {
    logError('updateShipment', error, { id, updates })
    throw error
  }
}

export async function deleteShipment(id: string): Promise<void> {
  try {
    if (isDemoMode()) {
      demoDatabase.deleteShipment(id)
      return
    }

    await retryOperation(
      async () => {
        const { error } = await getSupabase()
          .from('shipments')
          .delete()
          .eq('id', id)

        if (error) throw error
        return true
      },
      { maxRetries: 2 }
    )
  } catch (error) {
    logError('deleteShipment', error, { id })
    throw error
  }
}
