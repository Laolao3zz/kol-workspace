import type { Collaboration, Invitation, KOL, Product, Shipment } from '../types'
import { getKolContentShape } from './contentShape'

export type ProductLike = string | Product

export function getProductName(product: ProductLike): string {
  return typeof product === 'string' ? product : product.name
}

export function normalizeProductName(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() || ''
}

export function sameProduct(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalizeProductName(left) === normalizeProductName(right)
}

function intersects(left: string[], right: string[]): boolean {
  const rightSet = new Set(right.map(normalizeProductName).filter(Boolean))
  return left.some(item => rightSet.has(normalizeProductName(item)))
}

export function mergeOpportunityProducts(products: Product[], _productNames: string[]): ProductLike[] {
  const merged: ProductLike[] = []
  const seen = new Set<string>()

  const add = (product: ProductLike) => {
    const name = getProductName(product).trim()
    if (!name) return

    const key = normalizeProductName(name)
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
  return invitations.some(invitation => sameProduct(invitation.product, productName)) ||
    shipments.some(shipment => sameProduct(shipment.product, productName)) ||
    collaborations.some(collaboration => sameProduct(collaboration.product, productName))
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
