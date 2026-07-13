import type { Invitation, Shipment } from '../types'

export const AUTO_CREATED_SHIPMENT_NOTE = '邀约同意且我方继续推进后自动生成'

export function isInvitationApprovedForShipment(invitation: Invitation): boolean {
  return invitation.reply_result === '同意合作' && invitation.decision === '继续推进'
}

export function shouldCreateShipmentForInvitation(
  previous: Invitation | null | undefined,
  next: Invitation
): boolean {
  return isInvitationApprovedForShipment(next) &&
    (!previous || !isInvitationApprovedForShipment(previous))
}

export function shouldReconcileApprovedInvitation(
  invitation: Invitation,
  shipments: Shipment[]
): boolean {
  if (!isInvitationApprovedForShipment(invitation)) return false

  return !shipments.some(shipment =>
    shipment.source_invitation_id?.trim() === invitation.id
  )
}

export function isAutoCreatedPendingShipment(shipment: Shipment): boolean {
  return Boolean(
    shipment.status === '待寄出' &&
    !shipment.tracking_number?.trim() &&
    !shipment.sample_date &&
    !shipment.delivered_at &&
    !shipment.archived_at &&
    !shipment.completed_at &&
    !shipment.expected_publish_date &&
    shipment.progress_status === '待制作' &&
    !shipment.progress_notes?.trim() &&
    shipment.updated_at === shipment.created_at &&
    shipment.notes?.trim() === AUTO_CREATED_SHIPMENT_NOTE
  )
}

export function findStaleAutoCreatedPendingShipments(
  shipments: Shipment[],
  invitations: Invitation[]
): Shipment[] {
  return shipments.filter(shipment =>
    isAutoCreatedPendingShipment(shipment) &&
    Boolean(shipment.source_invitation_id?.trim()) &&
    !invitations.some(invitation =>
      invitation.id === shipment.source_invitation_id &&
      isInvitationApprovedForShipment(invitation)
    )
  )
}
