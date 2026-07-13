import type { Collaboration, Shipment } from '../types'

const defaultToday = () => new Date().toISOString().slice(0, 10)

export type CollaborationPayload = Omit<Collaboration, 'id'>

export const shipmentHistoryMarker = (shipmentId: string) => `shipment:${shipmentId}`

const shipmentMarkerPattern = /\s*\[shipment:[^\]]+\]/g

export function stripShipmentHistoryMarkers(notes: string | null | undefined): string {
  return notes?.replace(shipmentMarkerPattern, '').replace(/[ \t]{2,}/g, ' ').trim() || ''
}

export function buildCompletionCollaborationPayload(
  shipment: Shipment,
  today = defaultToday()
): CollaborationPayload {
  return {
    kol_id: shipment.kol_id,
    shipment_id: shipment.id,
    product: shipment.product,
    publish_date: shipment.completed_at || today,
    work_url: '',
    views: null,
    comments: null,
    likes: null,
    fee: '',
    notes: '系统归档：合作已完成，待补作品链接和效果数据',
  }
}

export function findCollaborationForShipment(
  collaborations: Collaboration[],
  shipment: Shipment
): Collaboration | null {
  const linked = collaborations.find(collaboration => collaboration.shipment_id === shipment.id)
  if (linked) return linked

  const marker = shipmentHistoryMarker(shipment.id)
  const marked = collaborations.find(collaboration => collaboration.notes?.includes(marker))
  return marked || null
}

export function mergeCompletionCollaborationPayload(
  existing: Collaboration,
  fallback: CollaborationPayload
): Partial<Collaboration> {
  const existingNotes = stripShipmentHistoryMarkers(existing.notes)
  const notes = existingNotes || stripShipmentHistoryMarkers(fallback.notes)

  return {
    shipment_id: existing.shipment_id || fallback.shipment_id,
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
