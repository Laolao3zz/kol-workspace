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

function productKey(product: string): string {
  return product.trim().toLocaleLowerCase()
}

export function isAutoCreatedPendingShipment(shipment: Shipment): boolean {
  return Boolean(
    shipment.status === '待寄出' &&
    !shipment.tracking_number?.trim() &&
    !shipment.sample_date &&
    !shipment.archived_at &&
    shipment.notes?.trim() === AUTO_CREATED_SHIPMENT_NOTE
  )
}

export function findStaleAutoCreatedPendingShipments(
  shipments: Shipment[],
  invitations: Invitation[]
): Shipment[] {
  const approvedProducts = new Set(
    invitations
      .filter(isInvitationApprovedForShipment)
      .map(invitation => productKey(invitation.product))
      .filter(Boolean)
  )

  return shipments.filter(shipment =>
    isAutoCreatedPendingShipment(shipment) &&
    (shipment.source_invitation_id?.trim()
      ? !invitations.some(invitation =>
          invitation.id === shipment.source_invitation_id &&
          isInvitationApprovedForShipment(invitation)
        )
      : !approvedProducts.has(productKey(shipment.product)))
  )
}
