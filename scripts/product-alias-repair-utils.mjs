export function normalizeProductName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function isProductAliasRepairComplete(mapping) {
  return mapping.errors.length === 0 &&
    mapping.counts.total === 0 &&
    mapping.sourceProductIds.length === 0
}

function matchingIds(rows, normalizedName) {
  return (rows || [])
    .filter(row => normalizeProductName(row.product) === normalizedName)
    .map(row => row.id)
    .filter(Boolean)
}

export function buildProductAliasRepairPlan({
  aliases,
  products,
  invitations,
  shipments,
  collaborations,
}) {
  return aliases.map(alias => {
    const sourceKey = normalizeProductName(alias.source)
    const targetKey = normalizeProductName(alias.target)
    const sourceProducts = products.filter(product => normalizeProductName(product.name) === sourceKey)
    const targetProducts = products.filter(product => normalizeProductName(product.name) === targetKey)
    const errors = []

    if (sourceKey === targetKey) {
      errors.push('Alias source and target must be different products.')
    }

    if (targetProducts.length === 0) {
      errors.push(`Canonical product "${alias.target}" was not found.`)
    } else if (targetProducts.length > 1) {
      errors.push(`Canonical product "${alias.target}" is not unique.`)
    } else if (targetProducts[0].status === '归档') {
      errors.push(`Canonical product "${alias.target}" must not be archived.`)
    }

    if (sourceProducts.some(product => product.status !== '归档')) {
      errors.push(`Source product "${alias.source}" must be archived before deletion.`)
    }

    const references = {
      invitations: matchingIds(invitations, sourceKey),
      shipments: matchingIds(shipments, sourceKey),
      collaborations: matchingIds(collaborations, sourceKey),
    }
    const counts = {
      invitations: references.invitations.length,
      shipments: references.shipments.length,
      collaborations: references.collaborations.length,
      total: 0,
    }
    counts.total = counts.invitations + counts.shipments + counts.collaborations

    return {
      sourceName: alias.source,
      targetName: alias.target,
      sourceProductIds: sourceProducts.map(product => product.id),
      sourceProductStatuses: sourceProducts.map(product => product.status),
      targetProductId: targetProducts.length === 1 ? targetProducts[0].id : null,
      canonicalProductName: targetProducts.length === 1 ? targetProducts[0].name : null,
      targetProductStatus: targetProducts.length === 1 ? targetProducts[0].status : null,
      references,
      counts,
      errors,
      safeToDeleteSource: errors.length === 0 && sourceProducts.length > 0 && counts.total === 0,
    }
  })
}
