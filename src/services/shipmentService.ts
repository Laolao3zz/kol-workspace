import { getSupabase } from '../lib/supabase'
import type { Shipment } from '../types'

export type ShipmentInput = Omit<Shipment, 'id' | 'created_at' | 'updated_at'>

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
    .insert([shipment])
    .select()
    .single()

  if (error) throw error
  return data as Shipment
}

export async function updateShipment(
  id: string,
  updates: Partial<Shipment>
): Promise<Shipment> {
  const { id: _id, created_at: _created_at, ...safeUpdates } = updates

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
