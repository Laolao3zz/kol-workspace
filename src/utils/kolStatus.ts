import type { Collaboration, Invitation, KOL, Shipment } from '../types'

const shipmentTime = (shipment: Shipment) => shipment.sample_date || shipment.delivered_at || shipment.created_at || ''
const invitationTime = (invitation: Invitation) => invitation.invited_at || ''
const collaborationTime = (collaboration: Collaboration) => collaboration.publish_date || collaboration.cooperation_date || ''

export function getLatestShipment(shipments: Shipment[] = []): Shipment | null {
  if (shipments.length === 0) return null
  return shipments.reduce((latest, shipment) => shipmentTime(shipment) > shipmentTime(latest) ? shipment : latest)
}

export function getLatestInvitation(invitations: Invitation[] = []): Invitation | null {
  if (invitations.length === 0) return null
  return invitations.reduce((latest, invitation) => invitationTime(invitation) > invitationTime(latest) ? invitation : latest)
}

export function getLatestCollaboration(collaborations: Collaboration[] = []): Collaboration | null {
  if (collaborations.length === 0) return null
  return collaborations.reduce((latest, collaboration) => collaborationTime(collaboration) > collaborationTime(latest) ? collaboration : latest)
}

export function countCompletedCollaborations(collaborations: Collaboration[] = []): number {
  return collaborations.length
}

const normalizeProgressStatus = (status?: string | null) => {
  if (!status || status === '已签收') return '待制作'
  if (status === '暂停/异常') return '进度异常'
  if (status === '已完成') return '合作完成'
  return status
}

export function deriveKolStatus(
  kol: KOL,
  invitations: Invitation[] = [],
  shipments: Shipment[] = [],
  collaborations: Collaboration[] = []
): string {
  const latestShipment = getLatestShipment(shipments)
  if (latestShipment) {
    if (latestShipment.completed_at || latestShipment.progress_status === '已完成') return '合作完成'
    if (latestShipment.status === '已签收') return normalizeProgressStatus(latestShipment.progress_status)
    if (latestShipment.tracking_number?.trim()) return '运输中'
    return '待寄出'
  }

  const latestCollaboration = getLatestCollaboration(collaborations)
  if (latestCollaboration) return '合作完成'

  const latestInvitation = getLatestInvitation(invitations)
  if (latestInvitation) {
    if (!latestInvitation.replied || latestInvitation.reply_result === '未回复') return '已邀约'
    if (latestInvitation.reply_result.includes('同意')) return '待寄出'
    if (latestInvitation.reply_result.includes('拒绝')) return '拒绝合作'
    return '已邀约'
  }

  if (kol.status === '沟通中' || kol.status === '未回复') return '已邀约'
  if (kol.status === '合作完成') return '未首触'
  return kol.status || '未首触'
}

export function applyKolSnapshot(
  kol: KOL,
  invitations: Invitation[] = [],
  shipments: Shipment[] = [],
  collaborations: Collaboration[] = []
): KOL {
  const latestShipment = getLatestShipment(shipments)
  return {
    ...kol,
    status: deriveKolStatus(kol, invitations, shipments, collaborations),
    sample_product: latestShipment?.product || kol.sample_product || '',
    sample_date: latestShipment?.sample_date || null,
    tracking_number: latestShipment?.tracking_number || '',
    shipping_details: latestShipment?.shipping_details || kol.shipping_details || '',
  }
}
