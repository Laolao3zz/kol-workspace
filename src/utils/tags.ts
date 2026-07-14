export function collectTagOptions(...groups: string[][]): string[] {
  const variantsByKey = new Map<string, Map<string, number>>()

  for (const rawTag of groups.flat()) {
    const tag = rawTag.trim()
    const key = tag.toLocaleLowerCase()
    if (!tag) continue
    const variants = variantsByKey.get(key) || new Map<string, number>()
    variants.set(tag, (variants.get(tag) || 0) + 1)
    variantsByKey.set(key, variants)
  }

  return [...variantsByKey.values()].map(variants =>
    [...variants.entries()].sort(([left, leftCount], [right, rightCount]) => {
      if (leftCount !== rightCount) return rightCount - leftCount
      const leftIsUpper = left === left.toLocaleUpperCase() && /[A-Z]/.test(left)
      const rightIsUpper = right === right.toLocaleUpperCase() && /[A-Z]/.test(right)
      if (leftIsUpper !== rightIsUpper) return leftIsUpper ? -1 : 1
      return 0
    })[0][0]
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
}

export function canonicalizeTags(tags: string[], options: string[] = []): string[] {
  const canonicalByKey = new Map(
    collectTagOptions(options).map(tag => [tag.toLocaleLowerCase(), tag])
  )

  return collectTagOptions(tags.map(rawTag => {
    const tag = rawTag.trim()
    return canonicalByKey.get(tag.toLocaleLowerCase()) || tag
  }))
}
