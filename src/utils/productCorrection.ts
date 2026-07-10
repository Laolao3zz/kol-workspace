import type { Collaboration, Invitation, Product, Shipment } from '../types'
import { sameProduct } from './productMatching'

type ProductRecord = Pick<Invitation | Shipment | Collaboration, 'id' | 'kol_id' | 'product'>

export interface ProductCorrectionSources {
  invitations: Invitation[]
  shipments: Shipment[]
  collaborations: Collaboration[]
}

export interface ProductReferenceSources {
  invitations: Array<{ product: string | null | undefined }>
  shipments: Array<{ product: string | null | undefined }>
  collaborations: Array<{ product: string | null | undefined }>
}

export interface ProductCorrectionPlan {
  invitations: Invitation[]
  shipments: Shipment[]
  collaborations: Collaboration[]
  total: number
}

export interface ProductReferenceCounts {
  invitations: number
  shipments: number
  collaborations: number
  total: number
}

export function resolveProductSelection(
  current: string,
  options: string[],
  preferredIdentity = ''
): string {
  const preferred = preferredIdentity
    ? options.find(option => sameProduct(option, preferredIdentity))
    : undefined
  if (preferred) return preferred
  return options.includes(current) ? current : options[0] || ''
}

function matchesCorrectionSource(record: ProductRecord, kolId: string, sourceProduct: string): boolean {
  return record.kol_id === kolId && record.product?.trim() === sourceProduct.trim()
}

export function buildProductCorrectionPlan({
  kolId,
  sourceProduct,
  targetProduct,
  invitations,
  shipments,
  collaborations,
}: ProductCorrectionSources & {
  kolId: string
  sourceProduct: string
  targetProduct: string
}): ProductCorrectionPlan {
  const source = sourceProduct.trim()
  const target = targetProduct.trim()
  if (!source || !target || source === target) {
    return { invitations: [], shipments: [], collaborations: [], total: 0 }
  }

  const plan = {
    invitations: invitations.filter(record => matchesCorrectionSource(record, kolId, source)),
    shipments: shipments.filter(record => matchesCorrectionSource(record, kolId, source)),
    collaborations: collaborations.filter(record => matchesCorrectionSource(record, kolId, source)),
  }

  return {
    ...plan,
    total: plan.invitations.length + plan.shipments.length + plan.collaborations.length,
  }
}

export function countProductReferences(
  productName: string,
  sources: ProductReferenceSources
): ProductReferenceCounts {
  const counts = {
    invitations: sources.invitations.filter(record => sameProduct(record.product, productName)).length,
    shipments: sources.shipments.filter(record => sameProduct(record.product, productName)).length,
    collaborations: sources.collaborations.filter(record => sameProduct(record.product, productName)).length,
  }

  return {
    ...counts,
    total: counts.invitations + counts.shipments + counts.collaborations,
  }
}

export function countProductDeletionReferences(
  product: Pick<Product, 'id' | 'name'>,
  products: Array<Pick<Product, 'id' | 'name'>>,
  sources: ProductReferenceSources
): ProductReferenceCounts {
  const hasEquivalentSibling = products.some(candidate =>
    candidate.id !== product.id && sameProduct(candidate.name, product.name)
  )
  if (!hasEquivalentSibling) return countProductReferences(product.name, sources)

  const matchesExactSpelling = (value: string | null | undefined) => value?.trim() === product.name.trim()
  const counts = {
    invitations: sources.invitations.filter(record => matchesExactSpelling(record.product)).length,
    shipments: sources.shipments.filter(record => matchesExactSpelling(record.product)).length,
    collaborations: sources.collaborations.filter(record => matchesExactSpelling(record.product)).length,
  }

  return {
    ...counts,
    total: counts.invitations + counts.shipments + counts.collaborations,
  }
}
