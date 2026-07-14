import type { Collaboration } from '../types'

export function collectCollaborationHistoryProducts(
  collaborations: Array<Pick<Collaboration, 'product'>>
): string[] {
  const productsByKey = new Map<string, string>()

  for (const collaboration of collaborations) {
    const product = collaboration.product?.trim()
    if (!product) continue
    const key = product.toLocaleLowerCase()
    if (!productsByKey.has(key)) productsByKey.set(key, product)
  }

  return [...productsByKey.values()].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
  )
}
