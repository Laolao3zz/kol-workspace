import { DollarSign, ExternalLink, Eye, MessageSquare, Search, ThumbsUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import type { Collaboration, KOL } from '../types'
import { hasPublishReadyCollaborationSignal } from '../utils/kolStatus'
import { sameProduct } from '../utils/productMatching'
import { getContentShapeMetricLabels, getKolContentShape } from '../utils/contentShape'
import { stripShipmentHistoryMarkers } from '../utils/collaborationArchive'
import { toSafeExternalUrl } from '../utils/profileUrl'
import { getAvatarTone } from '../utils/visualTone'

interface Props {
  kols: KOL[]
  collaborationsByKol: Record<string, Collaboration[]>
  productOptions: string[]
  onSelectKol: (kol: KOL) => void
}

interface HistoryRow {
  kol: KOL
  collaboration: Collaboration
}

const formatNumber = (value: number | null) => {
  if (!value) return '-'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

const parseFee = (value: string) => {
  const numeric = Number(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(numeric) ? numeric : 0
}

export default function CollaborationHistoryView({ kols, collaborationsByKol, productOptions, onSelectKol }: Props) {
  const [query, setQuery] = useState('')
  const [product, setProduct] = useState('')

  const rows = useMemo<HistoryRow[]>(() => {
    const kolMap = new Map(kols.map(kol => [kol.id, kol]))
    return Object.entries(collaborationsByKol).flatMap(([kolId, collaborations]) => {
      const kol = kolMap.get(kolId)
      if (!kol) return []
      return collaborations
        .filter(hasPublishReadyCollaborationSignal)
        .map(collaboration => ({ kol, collaboration }))
    }).sort((a, b) => (b.collaboration.publish_date || '').localeCompare(a.collaboration.publish_date || ''))
  }, [kols, collaborationsByKol])

  const q = query.trim().toLowerCase()
  const filtered = rows.filter(row => {
    const matchesQuery = !q || [
      row.kol.name,
      row.kol.platform,
      row.kol.country,
      row.collaboration.product,
      stripShipmentHistoryMarkers(row.collaboration.notes),
      row.collaboration.fee,
    ].some(value => String(value || '').toLowerCase().includes(q))
    const matchesProduct = !product || sameProduct(row.collaboration.product, product)
    return matchesQuery && matchesProduct
  })

  const totals = filtered.reduce((acc, row) => {
    acc.views += row.collaboration.views || 0
    acc.likes += row.collaboration.likes || 0
    acc.comments += row.collaboration.comments || 0
    acc.fee += parseFee(row.collaboration.fee || '')
    return acc
  }, { views: 0, likes: 0, comments: 0, fee: 0 })

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-black/[0.06] bg-white px-8 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <HistoryStat icon={<Eye className="h-4 w-4" />} label="播放/访问" value={formatNumber(totals.views)} tone="text-[#0066FF]" />
          <HistoryStat icon={<ThumbsUp className="h-4 w-4" />} label="点赞/互动" value={formatNumber(totals.likes)} tone="text-[#34C759]" />
          <HistoryStat icon={<MessageSquare className="h-4 w-4" />} label="总评论" value={formatNumber(totals.comments)} tone="text-[#FF9F0A]" />
          <HistoryStat icon={<DollarSign className="h-4 w-4" />} label="费用记录" value={totals.fee ? totals.fee.toLocaleString() : '-'} tone="text-[#1D1D1F]" />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#AEAEB2]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="搜索历史"
                className="h-10 w-full rounded-[12px] border border-black/[0.08] bg-[#F5F5F7] pl-9 pr-3 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
              />
            </div>
            <select
              value={product}
              onChange={event => setProduct(event.target.value)}
              className="h-10 rounded-[12px] border border-black/[0.08] bg-white px-3 text-xs font-bold text-[#6E6E73] outline-none focus:border-[#0066FF]/40"
            >
              <option value="">全部产品</option>
              {productOptions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-8 py-5">
        <div className="overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-[#FBFBFD]">
              <tr className="border-b border-black/[0.06] text-[11px] font-bold text-[#86868B]">
                <th className="px-4 py-3">KOL</th>
                <th className="px-4 py-3">产品</th>
                <th className="px-4 py-3">发布日期</th>
                <th className="px-4 py-3">作品</th>
                <th className="px-4 py-3 text-right">播放/访问</th>
                <th className="px-4 py-3 text-right">点赞/互动</th>
                <th className="px-4 py-3 text-right">评论</th>
                <th className="px-4 py-3">复盘</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {filtered.map(row => {
                const metricLabels = getContentShapeMetricLabels(getKolContentShape(row.kol))
                const workHref = toSafeExternalUrl(row.collaboration.work_url)
                return (
                <tr key={row.collaboration.id} className="transition hover:bg-[#F5F5F7]">
                  <td className="px-4 py-3">
                    <button onClick={() => onSelectKol(row.kol)} className="flex min-w-0 items-center gap-3 text-left">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${getAvatarTone(row.kol.name)}`}>{row.kol.name.slice(0, 2).toUpperCase()}</div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-extrabold text-[#1D1D1F]">{row.kol.name}</div>
                        <div className="truncate text-[11px] font-semibold text-[#86868B]">{row.kol.platform} · {getKolContentShape(row.kol)} · {row.kol.country || '-'}</div>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-bold text-[#6E6E73]">{row.collaboration.product}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#6E6E73]">{row.collaboration.publish_date || '-'}</td>
                  <td className="px-4 py-3">
                    {workHref ? (
                      <a href={workHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#0066FF] hover:bg-blue-100">
                        <ExternalLink className="h-3.5 w-3.5" /> 查看
                      </a>
                    ) : <span className="text-xs font-semibold text-[#AEAEB2]">-</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-extrabold tabular-nums text-[#1D1D1F]" title={metricLabels.views}>{formatNumber(row.collaboration.views)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-[#6E6E73]" title={metricLabels.likes}>{formatNumber(row.collaboration.likes)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-[#6E6E73]">{formatNumber(row.collaboration.comments)}</td>
                  <td className="max-w-[260px] px-4 py-3 text-xs font-medium text-[#6E6E73]">
                    <span className="line-clamp-2">{stripShipmentHistoryMarkers(row.collaboration.notes) || '-'}</span>
                  </td>
                </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#F5F5F7] text-[#86868B]">
                        <Eye className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-extrabold text-[#1D1D1F]">暂无合作历史</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function HistoryStat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="flex min-w-[150px] items-center gap-3 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <span className="text-[#86868B]">{icon}</span>
      <div>
        <div className={`text-base font-extrabold tabular-nums ${tone}`}>{value}</div>
        <div className="text-[11px] font-bold text-[#86868B]">{label}</div>
      </div>
    </div>
  )
}
