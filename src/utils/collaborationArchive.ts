import type { Collaboration, Shipment } from '../types'
import { sameProduct } from './productMatching'

const defaultToday = () => new Date().toISOString().slice(0, 10)

export type CollaborationPayload = Omit<Collaboration, 'id'>

export const shipmentHistoryMarker = (shipmentId: string) => `shipment:${shipmentId}`

const shipmentMarkerPattern = /\[shipment:[^\]]+\]/

export function withShipmentHistoryMarker(notes: string | null | undefined, shipmentId: string): string {
  const marker = `[${shipmentHistoryMarker(shipmentId)}]`
  const normalized = notes?.trim() || '系统归档'
  return normalized.includes(marker) ? normalized : `${normalized} ${marker}`
}

export function buildCompletionCollaborationPayload(
  shipment: Shipment,
  today = defaultToday()
): CollaborationPayload {
  return {
    kol_id: shipment.kol_id,
    product: shipment.product,
    publish_date: shipment.completed_at || today,
    work_url: '',
    views: null,
    comments: null,
    likes: null,
    fee: '',
    notes: withShipmentHistoryMarker('系统归档：合作已完成，待补作品链接和效果数据', shipment.id),
  }
}

export function findCollaborationForShipment(
  collaborations: Collaboration[],
  shipment: Shipment
): Collaboration | null {
  const marker = shipmentHistoryMarker(shipment.id)
  const marked = collaborations.find(collaboration => collaboration.notes?.includes(marker))
  if (marked) return marked

  const productMatches = collaborations.filter(collaboration => sameProduct(collaboration.product, shipment.product))
  return productMatches.length === 1 ? productMatches[0] : null
}

export function mergeCompletionCollaborationPayload(
  existing: Collaboration,
  fallback: CollaborationPayload
): Partial<Collaboration> {
  const fallbackMarker = fallback.notes.match(shipmentMarkerPattern)?.[0] || ''
  const existingNotes = existing.notes?.trim()
  const notes = existingNotes
    ? fallbackMarker && !existingNotes.includes(fallbackMarker)
      ? `${existingNotes} ${fallbackMarker}`
      : existingNotes
    : fallback.notes

  return {
    product: existing.product || fallback.product,
    publish_date: existing.publish_date || fallback.publish_date,
    work_url: existing.work_url || fallback.work_url,
    views: existing.views ?? fallback.views,
    comments: existing.comments ?? fallback.comments,
    likes: existing.likes ?? fallback.likes,
    fee: existing.fee || fallback.fee,
    notes,
  }
}
