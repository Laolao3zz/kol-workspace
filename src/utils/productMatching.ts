import type { Collaboration, Invitation, KOL, Product, Shipment } from '../types'
import { getKolContentShape } from './contentShape'

export type ProductLike = string | Product

export function getProductName(product: ProductLike): string {
  return typeof product === 'string' ? product : product.name
}

function normalizeToken(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function intersects(left: string[], right: string[]): boolean {
  const rightSet = new Set(right.map(normalizeToken).filter(Boolean))
  return left.some(item => rightSet.has(normalizeToken(item)))
}

export function mergeOpportunityProducts(products: Product[], _productNames: string[]): ProductLike[] {
  const merged: ProductLike[] = []
  const seen = new Set<string>()

  const add = (product: ProductLike) => {
    const name = getProductName(product).trim()
    if (!name) return

    const key = normalizeToken(name)
    if (seen.has(key)) return

    seen.add(key)
    merged.push(typeof product === 'string' ? name : product)
  }

  products.filter(product => product.status !== '归档').forEach(add)

  return merged
}

export function hasProductRecordForKol(
  productName: string,
  invitations: Invitation[],
  shipments: Shipment[],
  collaborations: Collaboration[]
): boolean {
  return invitations.some(invitation => invitation.product === productName) ||
    shipments.some(shipment => shipment.product === productName) ||
    collaborations.some(collaboration => collaboration.product === productName)
}

export function shouldShowProductForKol(
  kol: Pick<KOL, 'tags' | 'platform'>,
  product: ProductLike,
  hasExistingProductRecord = false
): boolean {
  if (hasExistingProductRecord) return true
  if (typeof product === 'string') return true
  if (product.status === '归档') return false

  const targetShapes = product.target_content_shapes || []
  if (targetShapes.length > 0 && !targetShapes.includes(getKolContentShape(kol))) {
    return false
  }

  const targetTags = product.target_kol_tags || []
  if (targetTags.length === 0) return true

  return intersects(targetTags, kol.tags || [])
}
