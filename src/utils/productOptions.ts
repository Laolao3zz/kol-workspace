import type { Collaboration, Invitation, KOL, Product, Shipment } from '../types'

type ProductRecord = Pick<Invitation | Shipment | Collaboration, 'product'>

type ProductRecordMap = Record<string, ProductRecord[]>

interface ProductOptionSources {
  products?: Array<string | Pick<Product, 'name'>>
  kols?: Array<Pick<KOL, 'sample_product'>>
  invitations?: ProductRecord[] | ProductRecordMap
  shipments?: ProductRecord[]
  collaborations?: ProductRecord[]
  collaborationsByKol?: ProductRecordMap
}

function listFromRecordMap(records?: ProductRecord[] | ProductRecordMap): ProductRecord[] {
  if (!records) return []
  return Array.isArray(records) ? records : Object.values(records).flat()
}

function addProduct(optionsByKey: Map<string, string>, value: string | null | undefined) {
  const product = value?.trim()
  if (!product) return
  const key = product.toLocaleLowerCase()
  if (!optionsByKey.has(key)) {
    optionsByKey.set(key, product)
  }
}

export function collectProductOptions(sources: ProductOptionSources): string[] {
  const optionsByKey = new Map<string, string>()

  sources.products?.forEach(product => addProduct(optionsByKey, typeof product === 'string' ? product : product.name))
  sources.kols?.forEach(kol => addProduct(optionsByKey, kol.sample_product))
  listFromRecordMap(sources.invitations).forEach(invitation => addProduct(optionsByKey, invitation.product))
  sources.shipments?.forEach(shipment => addProduct(optionsByKey, shipment.product))
  listFromRecordMap(sources.collaborations).forEach(collaboration => addProduct(optionsByKey, collaboration.product))
  listFromRecordMap(sources.collaborationsByKol).forEach(collaboration => addProduct(optionsByKey, collaboration.product))

  return [...optionsByKey.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  )
}
