import {
  buildProductAliasRepairPlan,
  isProductAliasRepairComplete,
} from './product-alias-repair-utils.mjs'

function assertValid(plan) {
  const errors = plan.flatMap(mapping => mapping.errors)
  if (errors.length > 0) throw new Error(errors.join(' '))
}

export async function runProductAliasRepair({
  aliases,
  apply,
  scan,
  rewriteReferences,
  deleteSourceProducts,
}) {
  const initialPlan = buildProductAliasRepairPlan({ aliases, ...(await scan()) })
  assertValid(initialPlan)

  if (!apply) return { mode: 'dry-run', plan: initialPlan }

  for (const mapping of initialPlan) {
    await rewriteReferences(mapping)
  }

  const verifiedPlan = buildProductAliasRepairPlan({ aliases, ...(await scan()) })
  assertValid(verifiedPlan)
  const residual = verifiedPlan.filter(mapping => mapping.counts.total > 0)
  if (residual.length > 0) {
    throw new Error(`Alias references remain after update: ${residual.map(mapping => mapping.sourceName).join(', ')}`)
  }

  for (const mapping of verifiedPlan) {
    await deleteSourceProducts(mapping)
  }

  const finalPlan = buildProductAliasRepairPlan({ aliases, ...(await scan()) })
  assertValid(finalPlan)
  const incomplete = finalPlan.filter(mapping => !isProductAliasRepairComplete(mapping))
  if (incomplete.length > 0) {
    throw new Error(`Product alias repair did not complete: ${incomplete.map(mapping => mapping.sourceName).join(', ')}`)
  }

  return { mode: 'apply', plan: finalPlan }
}
