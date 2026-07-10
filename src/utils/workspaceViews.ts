import type { Collaboration, Invitation, KOL, Product, Shipment } from '../types'
import { countCompletedCollaborations, hasRealCollaborationSignal } from './kolStatus'
import { getProductName, hasProductRecordForKol, sameProduct, shouldShowProductForKol } from './productMatching'

export type OpportunityStatus = '未触达' | '待回复' | '未回复' | '已同意' | '已拒绝' | '不推进' | '寄样中' | '内容中' | '已完成'
export type OpportunityStatusFilter = OpportunityStatus | '全部'
export type UnansweredInvitationStatus = '待回复' | '未回复'

export interface DashboardMetricSources {
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
}

export interface DashboardMetrics {
  totalKols: number
  pendingReplies: number
  pendingShipments: number
  inTransit: number
  contentFollowUp: number
  waitingArchive: number
  completedCollaborations: number
}

export interface ProductOpportunitySummary {
  product: string
  counts: Record<OpportunityStatus, number>
  rows: Array<{ kol: KOL; status: OpportunityStatus }>
}

export type ProductOpportunityRow = ProductOpportunitySummary['rows'][number]

const opportunityStatuses: OpportunityStatus[] = ['未触达', '待回复', '未回复', '已同意', '已拒绝', '不推进', '寄样中', '内容中', '已完成']
const PENDING_REPLY_WINDOW_DAYS = 14

export function filterOpportunityRowsByStatus(
  rows: ProductOpportunityRow[],
  status: OpportunityStatusFilter
): ProductOpportunityRow[] {
  if (status === '全部') return rows
  return rows.filter(row => row.status === status)
}

function flatInvitations(invitations: Record<string, Invitation[]>): Invitation[] {
  return Object.values(invitations).flat()
}

function flatCollaborations(collaborationsByKol: Record<string, Collaboration[]>): Collaboration[] {
  return Object.values(collaborationsByKol).flat()
}

function isCompletedShipment(shipment: Shipment): boolean {
  return Boolean(shipment.completed_at) || shipment.progress_status === '已完成'
}

function hasActiveShipment(shipment: Shipment): boolean {
  return !shipment.archived_at
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`).getTime()
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.POSITIVE_INFINITY
  return Math.floor((end - start) / 86400000)
}

function isPendingInvitation(invitation: Invitation): boolean {
  return !invitation.replied || !invitation.reply_result?.trim() || invitation.reply_result === '未回复'
}

function isWithinPendingReplyWindow(invitation: Invitation, currentDate: string): boolean {
  const ageDays = daysBetween(invitation.invited_at || '', currentDate)
  return ageDays <= PENDING_REPLY_WINDOW_DAYS
}

export function getUnansweredInvitationStatus(
  invitation: Invitation,
  currentDate = todayISO()
): UnansweredInvitationStatus | null {
  if (!isPendingInvitation(invitation)) return null
  return isWithinPendingReplyWindow(invitation, currentDate) ? '待回复' : '未回复'
}

function hasLaterWorkflowForInvitation(
  invitation: Invitation,
  shipments: Shipment[],
  collaborations: Collaboration[]
): boolean {
  return shipments.some(shipment =>
    shipment.kol_id === invitation.kol_id && sameProduct(shipment.product, invitation.product)
  ) || collaborations.some(collaboration =>
    collaboration.kol_id === invitation.kol_id &&
    sameProduct(collaboration.product, invitation.product) &&
    hasRealCollaborationSignal(collaboration)
  )
}

export function isActionablePendingInvitation(
  invitation: Invitation,
  shipments: Shipment[],
  collaborations: Collaboration[],
  currentDate = todayISO()
): boolean {
  if (getUnansweredInvitationStatus(invitation, currentDate) !== '待回复') return false
  if (hasLaterWorkflowForInvitation(invitation, shipments, collaborations)) return false

  return true
}

export function isOverduePendingInvitation(
  invitation: Invitation,
  shipments: Shipment[],
  collaborations: Collaboration[],
  currentDate = todayISO()
): boolean {
  if (getUnansweredInvitationStatus(invitation, currentDate) !== '未回复') return false
  return !hasLaterWorkflowForInvitation(invitation, shipments, collaborations)
}

export function getActionablePendingInvitations(
  invitations: Record<string, Invitation[]>,
  shipments: Shipment[],
  collaborationsByKol: Record<string, Collaboration[]>
): Invitation[] {
  const collaborations = flatCollaborations(collaborationsByKol)
  return flatInvitations(invitations).filter(invitation =>
    isActionablePendingInvitation(invitation, shipments, collaborations)
  )
}

export function countActiveShipments(shipments: Shipment[]): number {
  return shipments.filter(shipment =>
    hasActiveShipment(shipment) && !isCompletedShipment(shipment)
  ).length
}

export function buildDashboardMetrics(sources: DashboardMetricSources): DashboardMetrics {
  const activeShipments = sources.shipments.filter(hasActiveShipment)
  const collaborations = flatCollaborations(sources.collaborationsByKol)

  return {
    totalKols: sources.kols.length,
    pendingReplies: getActionablePendingInvitations(
      sources.invitations,
      sources.shipments,
      sources.collaborationsByKol
    ).length,
    pendingShipments: activeShipments.filter(shipment =>
      shipment.status === '待寄出' && !shipment.tracking_number?.trim()
    ).length,
    inTransit: activeShipments.filter(shipment =>
      shipment.status === '运输中' || (Boolean(shipment.tracking_number?.trim()) && shipment.status !== '已签收' && !isCompletedShipment(shipment))
    ).length,
    contentFollowUp: activeShipments.filter(shipment =>
      shipment.status === '已签收' && !isCompletedShipment(shipment)
    ).length,
    waitingArchive: activeShipments.filter(shipment =>
      isCompletedShipment(shipment) && !shipment.archived_at
    ).length,
    completedCollaborations: countCompletedCollaborations(collaborations),
  }
}

function latestInvitationForProduct(invitations: Invitation[], product: string): Invitation | null {
  const matches = invitations.filter(invitation => sameProduct(invitation.product, product))
  if (matches.length === 0) return null
  return matches.reduce((latest, invitation) => invitation.invited_at > latest.invited_at ? invitation : latest)
}

function shipmentForProduct(shipments: Shipment[], product: string): Shipment | null {
  const matches = shipments.filter(shipment => sameProduct(shipment.product, product) && hasActiveShipment(shipment))
  if (matches.length === 0) return null
  return matches[0]
}

function hasCollaborationForProduct(collaborations: Collaboration[], product: string): boolean {
  return collaborations.some(collaboration => sameProduct(collaboration.product, product) && hasRealCollaborationSignal(collaboration))
}

function opportunityStatusForKol(
  _kol: KOL,
  product: string,
  invitations: Invitation[],
  shipments: Shipment[],
  collaborations: Collaboration[],
  currentDate: string
): OpportunityStatus {
  if (hasCollaborationForProduct(collaborations, product)) return '已完成'

  const shipment = shipmentForProduct(shipments, product)
  if (shipment) {
    if (isCompletedShipment(shipment)) return '已完成'
    if (shipment.status === '已签收') return '内容中'
    if (shipment.status === '运输中' || shipment.tracking_number?.trim()) return '寄样中'
    return '已同意'
  }

  const latestInvitation = latestInvitationForProduct(invitations, product)
  if (!latestInvitation) return '未触达'
  const unansweredStatus = getUnansweredInvitationStatus(latestInvitation, currentDate)
  if (unansweredStatus) return unansweredStatus
  if (latestInvitation.decision === '我方拒绝') return '不推进'
  if (latestInvitation.reply_result?.includes('拒绝')) return '已拒绝'
  if (latestInvitation.reply_result?.includes('同意')) return '已同意'

  return '待回复'
}

export function buildProductOpportunitySummary(
  sources: DashboardMetricSources & { products: Array<string | Product>; currentDate?: string }
): ProductOpportunitySummary[] {
  const currentDate = sources.currentDate || todayISO()

  return sources.products.map(product => {
    const productName = getProductName(product)
    const rows = sources.kols.flatMap(kol => {
      const invitations = sources.invitations[kol.id] || []
      const shipments = sources.shipments.filter(shipment => shipment.kol_id === kol.id)
      const collaborations = sources.collaborationsByKol[kol.id] || []
      const hasExistingProductRecord = hasProductRecordForKol(productName, invitations, shipments, collaborations)

      if (!shouldShowProductForKol(kol, product, hasExistingProductRecord)) {
        return []
      }

      return [{
        kol,
        status: opportunityStatusForKol(
        kol,
          productName,
          invitations,
          shipments,
          collaborations,
          currentDate
        ),
      }]
    })

    const counts = opportunityStatuses.reduce<Record<OpportunityStatus, number>>((map, status) => {
      map[status] = rows.filter(row => row.status === status).length
      return map
    }, {} as Record<OpportunityStatus, number>)

    return { product: productName, rows, counts }
  })
}
