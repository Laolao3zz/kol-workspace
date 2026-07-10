export async function collectAllPages<T>(
  loadPage: (from: number, to: number) => Promise<T[]>,
  pageSize = 500
): Promise<T[]> {
  const rows: T[] = []
  let from = 0

  while (true) {
    const page = await loadPage(from, from + pageSize - 1)
    rows.push(...page)
    if (page.length < pageSize) return rows
    from += pageSize
  }
}
