import type { Collaboration, Invitation, KOL, Shipment } from '../types'

const shipmentTime = (shipment: Shipment) => shipment.sample_date || shipment.delivered_at || shipment.created_at || ''
const invitationTime = (invitation: Invitation) => invitation.invited_at || ''
const collaborationTime = (collaboration: Collaboration) => collaboration.publish_date || ''

export function getLatestShipment(shipments: Shipment[] = []): Shipment | null {
  if (shipments.length === 0) return null
  return shipments.reduce((latest, shipment) => shipmentTime(shipment) > shipmentTime(latest) ? shipment : latest)
}

export function getLatestInvitation(invitations: Invitation[] = []): Invitation | null {
  if (invitations.length === 0) return null
  return invitations.reduce((latest, invitation) => invitationTime(invitation) > invitationTime(latest) ? invitation : latest)
}

export function hasRealCollaborationSignal(collaboration: Collaboration): boolean {
  return Boolean(
    collaboration.publish_date?.trim() ||
    collaboration.work_url?.trim() ||
    Number(collaboration.views || 0) > 0 ||
    Number(collaboration.comments || 0) > 0 ||
    Number(collaboration.likes || 0) > 0 ||
    collaboration.notes?.includes('系统归档')
  )
}

export function getLatestCollaboration(collaborations: Collaboration[] = []): Collaboration | null {
  const realCollaborations = collaborations.filter(hasRealCollaborationSignal)
  if (realCollaborations.length === 0) return null
  return realCollaborations.reduce((latest, collaboration) => collaborationTime(collaboration) > collaborationTime(latest) ? collaboration : latest)
}

export function countCompletedCollaborations(collaborations: Collaboration[] = []): number {
  return collaborations.filter(hasRealCollaborationSignal).length
}

const normalizeLegacyStatus = (status?: string | null) => {
  if (!status) return '未首触'
  if (status === '沟通中' || status === '未回复') return '已邀约'
  if (status === '已签收' || status === '待制作' || status === '制作中' || status === '待发布') return '内容跟进'
  if (status === '暂停/异常' || status === '进度异常') return '异常'
  return status
}

const isProgressAbnormal = (status?: string | null) => status === '暂停/异常' || status === '进度异常'

const isShipmentCompleted = (shipment: Shipment) => Boolean(shipment.completed_at) || shipment.progress_status === '已完成'
const isShipmentActive = (shipment: Shipment) => !isShipmentCompleted(shipment)

export function deriveKolStatus(
  kol: KOL,
  invitations: Invitation[] = [],
  shipments: Shipment[] = [],
  collaborations: Collaboration[] = []
): string {
  const latestShipment = getLatestShipment(shipments)
  if (latestShipment) {
    if (isShipmentCompleted(latestShipment)) return '合作完成'
    if (latestShipment.status === '已签收') return isProgressAbnormal(latestShipment.progress_status) ? '异常' : '内容跟进'
    if (latestShipment.tracking_number?.trim() || latestShipment.status === '运输中') return '运输中'
    return '待寄出'
  }

  const latestCollaboration = getLatestCollaboration(collaborations)
  if (latestCollaboration && !shipments.some(isShipmentActive)) return '合作完成'

  const latestInvitation = getLatestInvitation(invitations)
  if (latestInvitation) {
    if (!latestInvitation.replied || latestInvitation.reply_result === '未回复') return '已邀约'
    if (latestInvitation.reply_result.includes('同意')) return '待寄出'
    if (latestInvitation.reply_result.includes('拒绝')) return '拒绝合作'
    return '已邀约'
  }

  return normalizeLegacyStatus(kol.status)
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
