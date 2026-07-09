export const KOL_HEALTH_COLUMNS = 'id, name, email, status, notes'
export const PRODUCT_HEALTH_COLUMNS = 'id, name, category, target_kol_tags, target_content_shapes, status, priority, notes'

export function findOrphanRows(childRows, parentRows, foreignKey) {
  const parentIds = new Set((parentRows || []).map(row => row.id))
  return (childRows || []).filter(row => row?.[foreignKey] && !parentIds.has(row[foreignKey]))
}
