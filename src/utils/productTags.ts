export function collectProductTagOptions(...groups: string[][]): string[] {
  const options: string[] = []
  const seen = new Set<string>()

  for (const tag of groups.flat()) {
    const normalized = tag.trim()
    const key = normalized.toLocaleLowerCase()
    if (!normalized || seen.has(key)) continue

    seen.add(key)
    options.push(normalized)
  }

  return options
}

export function canonicalizeProductTags(tags: string[], options: string[] = []): string[] {
  const canonicalByKey = new Map(
    options.map(tag => [tag.trim().toLocaleLowerCase(), tag.trim()])
  )

  return collectProductTagOptions(tags.map(tag => {
    const normalized = tag.trim()
    return canonicalByKey.get(normalized.toLocaleLowerCase()) || normalized
  }))
}
