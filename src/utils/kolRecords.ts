export interface KolRecord {
  kol_id: string
}

export function groupRecordsByKol<T extends KolRecord>(
  records: T[],
  kolIds: string[] = []
): Record<string, T[]> {
  const grouped = Object.fromEntries(kolIds.map(kolId => [kolId, [] as T[]]))

  return records.reduce<Record<string, T[]>>((map, record) => {
    map[record.kol_id] = [...(map[record.kol_id] || []), record]
    return map
  }, grouped)
}

export function replaceRecordsForKol<T extends KolRecord>(
  records: T[],
  kolId: string,
  replacements: T[]
): T[] {
  return [...records.filter(record => record.kol_id !== kolId), ...replacements]
}
