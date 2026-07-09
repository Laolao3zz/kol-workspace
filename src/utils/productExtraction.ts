import type { Collaboration, Invitation, KOL, Product } from '../types'
import type { ProductInput } from '../services/productService'
import { getKolContentShape, type ContentShape } from './contentShape'
import { hasRealCollaborationSignal } from './kolStatus'

interface ProductHistorySources {
  existingProducts: Product[]
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Array<{ kol_id: string; product: string }>
  collaborationsByKol: Record<string, Collaboration[]>
}

type ProductAccumulator = {
  name: string
  linkedKolIds: Set<string>
  strongSignals: number
  sourceCount: number
  tagCounts: Map<string, { label: string; count: number; firstSeen: number }>
  shapes: Set<ContentShape>
}

const nonProductTerms = new Set([
  '中文',
  '英语',
  '英文',
  '俄语',
  '日语',
  '韩语',
  '德语',
  '法语',
  '西班牙语',
  '葡萄牙语',
  '意大利语',
  '免费',
  '付费',
])

function normalizeKey(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function cleanProductName(value?: string | null): string {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function isLikelyProductName(value: string): boolean {
  const name = cleanProductName(value)
  if (name.length < 2 || name.length > 80) return false
  if (nonProductTerms.has(normalizeKey(name))) return false
  if (/https?:\/\//i.test(name) || /www\./i.test(name) || /@/.test(name)) return false
  if (/[$€￥¥]/.test(name)) return false
  if (/^[\d\s.,:;+\-_/()（）]+$/.test(name)) return false
  return true
}

function flatCollaborations(collaborationsByKol: Record<string, Collaboration[]>): Collaboration[] {
  return Object.values(collaborationsByKol).flat()
}

function addTags(accumulator: ProductAccumulator, kol: KOL | undefined) {
  if (!kol) return

  for (const rawTag of kol.tags || []) {
    const tag = rawTag.trim()
    if (!tag) continue

    const key = normalizeKey(tag)
    const current = accumulator.tagCounts.get(key) || {
      label: tag,
      count: 0,
      firstSeen: accumulator.tagCounts.size,
    }
    current.count += 1
    accumulator.tagCounts.set(key, current)
  }

  accumulator.shapes.add(getKolContentShape(kol))
}

function createAccumulator(name: string): ProductAccumulator {
  return {
    name,
    linkedKolIds: new Set(),
    strongSignals: 0,
    sourceCount: 0,
    tagCounts: new Map(),
    shapes: new Set(),
  }
}

export function deriveProductDraftsFromHistory(sources: ProductHistorySources): ProductInput[] {
  const existingNames = new Set(sources.existingProducts.map(product => normalizeKey(product.name)))
  const kolsById = new Map(sources.kols.map(kol => [kol.id, kol]))
  const byProduct = new Map<string, ProductAccumulator>()

  const addRecord = (productName: string | null | undefined, kolId: string, strongSignal: boolean) => {
    const name = cleanProductName(productName)
    if (!isLikelyProductName(name)) return

    const key = normalizeKey(name)
    if (existingNames.has(key)) return

    const accumulator = byProduct.get(key) || createAccumulator(name)
    accumulator.sourceCount += 1
    if (strongSignal) accumulator.strongSignals += 1
    if (kolId) accumulator.linkedKolIds.add(kolId)
    addTags(accumulator, kolsById.get(kolId))
    byProduct.set(key, accumulator)
  }

  sources.kols.forEach(kol => addRecord(kol.sample_product, kol.id, true))
  Object.values(sources.invitations).flat().forEach(invitation => addRecord(invitation.product, invitation.kol_id, false))
  sources.shipments.forEach(shipment => addRecord(shipment.product, shipment.kol_id, true))
  flatCollaborations(sources.collaborationsByKol)
    .filter(hasRealCollaborationSignal)
    .forEach(collaboration => addRecord(collaboration.product, collaboration.kol_id, true))

  return [...byProduct.values()]
    .filter(item => item.strongSignals > 0 || item.linkedKolIds.size >= 2)
    .map(item => {
      const tags = [...item.tagCounts.values()]
        .sort((a, b) => b.count - a.count || a.firstSeen - b.firstSeen)
        .slice(0, 6)
        .map(tag => tag.label)
      const shapes = [...item.shapes]

      return {
        name: item.name,
        category: tags[0] || '',
        target_kol_tags: tags,
        target_content_shapes: shapes.length > 0 ? shapes : ['视频', '网站'],
        status: '在推',
        priority: Math.min(100, 30 + item.strongSignals * 10 + item.linkedKolIds.size * 2),
        notes: `从历史记录提取，关联 ${item.linkedKolIds.size} 位 KOL。`,
      }
    })
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
}
