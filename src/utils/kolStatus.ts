import type { Collaboration, Invitation, KOL, Shipment } from '../types'

const shipmentTime = (shipment: Shipment) => shipment.sample_date || shipment.delivered_at || shipment.created_at || ''
export const invitationTimelineKey = (invitation: Invitation) =>
  `${invitation.invited_at || ''}|${invitation.created_at || ''}`
const invitationDay = (invitation: Invitation) => invitation.invited_at || ''
const collaborationTime = (collaboration: Collaboration) => collaboration.publish_date || ''
const positiveNumber = (value: unknown) => Number(value || 0) > 0

export function getLatestShipment(shipments: Shipment[] = []): Shipment | null {
  if (shipments.length === 0) return null
  return shipments.reduce((latest, shipment) => shipmentTime(shipment) > shipmentTime(latest) ? shipment : latest)
}

export function getLatestInvitation(invitations: Invitation[] = []): Invitation | null {
  if (invitations.length === 0) return null
  return invitations.reduce((latest, invitation) =>
    invitationTimelineKey(invitation) > invitationTimelineKey(latest) ? invitation : latest
  )
}

export function hasRealCollaborationSignal(collaboration: Collaboration): boolean {
  return Boolean(
    collaboration.publish_date?.trim() ||
    collaboration.work_url?.trim() ||
    positiveNumber(collaboration.views) ||
    positiveNumber(collaboration.comments) ||
    positiveNumber(collaboration.likes) ||
    collaboration.notes?.includes('系统归档')
  )
}

export function hasPublishReadyCollaborationSignal(collaboration: Collaboration): boolean {
  return Boolean(
    collaboration.publish_date?.trim() ||
    collaboration.work_url?.trim() ||
    positiveNumber(collaboration.views) ||
    positiveNumber(collaboration.comments) ||
    positiveNumber(collaboration.likes)
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

const isProgressAbnormal = (status?: string | null) => status === '暂停/异常' || status === '进度异常'

const isInvitationApproved = (invitation: Invitation) => invitation.reply_result?.includes('同意') && invitation.decision === '继续推进'

const isShipmentCompleted = (shipment: Shipment) => Boolean(shipment.completed_at) || shipment.progress_status === '已完成'
const isShipmentActive = (shipment: Shipment) => !isShipmentCompleted(shipment)

export function deriveKolStatus(
  _kol: KOL,
  invitations: Invitation[] = [],
  shipments: Shipment[] = [],
  collaborations: Collaboration[] = []
): string {
  const activeShipments = shipments.filter(shipment => !shipment.archived_at)
  const latestShipment = getLatestShipment(activeShipments)
  if (latestShipment) {
    if (isShipmentCompleted(latestShipment)) return '合作完成'
    if (latestShipment.status === '已签收') return isProgressAbnormal(latestShipment.progress_status) ? '异常' : '内容跟进'
    if (latestShipment.tracking_number?.trim() || latestShipment.status === '运输中') return '运输中'
    return '待寄出'
  }

  const latestCollaboration = getLatestCollaboration(collaborations)
  const latestInvitation = getLatestInvitation(invitations)
  const invitationIsCurrent = latestInvitation && (
    !latestCollaboration ||
    invitationDay(latestInvitation) >= collaborationTime(latestCollaboration)
  )

  if (latestInvitation && invitationIsCurrent) {
    if (!latestInvitation.replied || latestInvitation.reply_result === '未回复') return '已邀约'
    if (isInvitationApproved(latestInvitation)) return '待寄出'
    return '已邀约'
  }

  if (latestCollaboration && !activeShipments.some(isShipmentActive)) return '合作完成'

  return '未首触'
}

export function applyKolSnapshot(
  kol: KOL,
  _invitations: Invitation[] = [],
  shipments: Shipment[] = [],
  _collaborations: Collaboration[] = []
): KOL {
  // status 字段以数据库为准，由副作用代码（邀约/寄样/合作的增删改）通过
  // deriveKolStatus + updateKOL 主动写库。这里不再覆盖，避免手动设置和
  // 已写入的自动化状态被推导值反弹。
  const latestShipment = getLatestShipment(shipments)
  return {
    ...kol,
    sample_product: latestShipment?.product || kol.sample_product || '',
    sample_date: latestShipment?.sample_date || null,
    tracking_number: latestShipment?.tracking_number || '',
    shipping_details: latestShipment?.shipping_details || kol.shipping_details || '',
  }
}
