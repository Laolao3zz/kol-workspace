import { getSupabase, isDemoMode } from '../lib/supabase'
import type { Collaboration, Shipment } from '../types'
import { demoDatabase } from './demoDatabase'
import {
  buildCompletionCollaborationPayload,
  findCollaborationForShipment,
  mergeCompletionCollaborationPayload,
} from '../utils/collaborationArchive'
import { retryOperation } from '../utils/retry'
import { logError } from '../utils/logger'
import { collectAllPages } from '../utils/pagination'

const nullableDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return value == null ? null : String(value)
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const nullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeCollaborationPayload(
  collab: Partial<Collaboration>
): Partial<Collaboration> {
  const payload: Partial<Collaboration> = {}

  if ('kol_id' in collab) payload.kol_id = collab.kol_id
  if ('product' in collab) payload.product = collab.product?.trim() || ''
  if ('publish_date' in collab) payload.publish_date = nullableDate(collab.publish_date)
  if ('work_url' in collab) payload.work_url = collab.work_url?.trim() || ''
  if ('views' in collab) payload.views = nullableNumber(collab.views)
  if ('comments' in collab) payload.comments = nullableNumber(collab.comments)
  if ('likes' in collab) payload.likes = nullableNumber(collab.likes)
  if ('fee' in collab) payload.fee = collab.fee?.trim() || ''
  if ('notes' in collab) payload.notes = collab.notes?.trim() || ''

  return payload
}

export async function getCollaborations(): Promise<Collaboration[]> {
  try {
    if (isDemoMode()) {
      return demoDatabase.getCollaborations()
    }

    const result = await retryOperation(
      async () => collectAllPages(async (from, to) => {
        const { data, error } = await getSupabase()
          .from('collaborations')
          .select('*')
          .order('publish_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)

        if (error) throw error
        return data || []
      }),
      { maxRetries: 2 }
    )

    return result as Collaboration[]
  } catch (error) {
    logError('getCollaborations', error)
    throw error
  }
}

export async function getCollaborationsByKOL(kolId: string): Promise<Collaboration[]> {
  try {
    if (isDemoMode()) {
      return demoDatabase.getCollaborationsByKOL(kolId)
    }

    const result = await retryOperation(
      async () => collectAllPages(async (from, to) => {
        const { data, error } = await getSupabase()
          .from('collaborations')
          .select('*')
          .eq('kol_id', kolId)
          .order('publish_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })
          .range(from, to)

        if (error) throw error
        return data || []
      }),
      { maxRetries: 2 }
    )

    return result as Collaboration[]
  } catch (error) {
    logError('getCollaborationsByKOL', error, { kolId })
    throw error
  }
}

export async function createCollaboration(
  collab: Omit<Collaboration, 'id'>
): Promise<Collaboration> {
  try {
    const payload = normalizeCollaborationPayload(collab)

    if (isDemoMode()) {
      return demoDatabase.createCollaboration(payload as Partial<Collaboration> & Pick<Collaboration, 'kol_id' | 'product'>)
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('collaborations')
          .insert([payload])
          .select()
          .single()

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Collaboration
  } catch (error) {
    logError('createCollaboration', error, { collab })
    throw error
  }
}

export async function updateCollaboration(
  id: string,
  updates: Partial<Collaboration>
): Promise<Collaboration> {
  try {
    const safeUpdates = normalizeCollaborationPayload(updates)

    if (isDemoMode()) {
      return demoDatabase.updateCollaboration(id, safeUpdates)
    }

    const result = await retryOperation(
      async () => {
        const { data, error } = await getSupabase()
          .from('collaborations')
          .update(safeUpdates)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error
        return data
      },
      { maxRetries: 2 }
    )

    return result as Collaboration
  } catch (error) {
    logError('updateCollaboration', error, { id, updates })
    throw error
  }
}

export async function deleteCollaboration(id: string): Promise<void> {
  try {
    if (isDemoMode()) {
      demoDatabase.deleteCollaboration(id)
      return
    }

    await retryOperation(
      async () => {
        const { error } = await getSupabase().from('collaborations').delete().eq('id', id)
        if (error) throw error
        return true
      },
      { maxRetries: 2 }
    )
  } catch (error) {
    logError('deleteCollaboration', error, { id })
    throw error
  }
}

export async function ensureCompletionCollaboration(shipment: Shipment): Promise<Collaboration> {
  try {
    const payload = buildCompletionCollaborationPayload(shipment)
    const existingCollaborations = await getCollaborationsByKOL(shipment.kol_id)
    const existing = findCollaborationForShipment(existingCollaborations, shipment)

    if (existing) {
      return updateCollaboration(existing.id, mergeCompletionCollaborationPayload(existing, payload))
    }

    return createCollaboration(payload)
  } catch (error) {
    logError('ensureCompletionCollaboration', error, { shipmentId: shipment.id, kolId: shipment.kol_id })
    throw error
  }
}
