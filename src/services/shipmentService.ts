import { getSupabase } from '../lib/supabase'
import type { Shipment } from '../types'

export type ShipmentInput = Omit<Shipment, 'id' | 'created_at' | 'updated_at'>

const nullableDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return value == null ? null : String(value)
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeShipmentPayload(shipment: Partial<Shipment>): Partial<Shipment> {
  const payload: Partial<Shipment> = {}

  if ('kol_id' in shipment) payload.kol_id = shipment.kol_id
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

export async function getShipments(): Promise<Shipment[]> {
  const { data, error } = await getSupabase()
    .from('shipments')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Shipment[]
}

export async function getShipmentsByKOL(kolId: string): Promise<Shipment[]> {
  const { data, error } = await getSupabase()
    .from('shipments')
    .select('*')
    .eq('kol_id', kolId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Shipment[]
}

export async function createShipment(shipment: ShipmentInput): Promise<Shipment> {
  const { data, error } = await getSupabase()
    .from('shipments')
    .insert([normalizeShipmentPayload(shipment)])
    .select()
    .single()

  if (error) throw error
  return data as Shipment
}

export async function updateShipment(
  id: string,
  updates: Partial<Shipment>
): Promise<Shipment> {
  const safeUpdates = normalizeShipmentPayload(updates)

  const { data, error } = await getSupabase()
    .from('shipments')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Shipment
}

export async function deleteShipment(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('shipments')
    .delete()
    .eq('id', id)

  if (error) throw error
}
