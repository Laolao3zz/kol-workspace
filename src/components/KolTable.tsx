import { ChevronLeft, ChevronRight, MailPlus, Plus, RefreshCw, Search, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Collaboration, Invitation, KOL, PLATFORMS, Shipment } from '../types'
import { createInvitation } from '../services/invitationService'
import { updateKOL } from '../services/kolService'
import { countCompletedCollaborations, deriveKolStatus } from '../utils/kolStatus'
import { collectProductOptions } from '../utils/productOptions'
import { CONTENT_SHAPES, getKolContentShape } from '../utils/contentShape'
import { isActionablePendingInvitation } from '../utils/workspaceViews'

interface Props {
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
  loading: boolean
  onSelect: (kol: KOL) => void
  selectedId: string | null
  productOptions: string[]
  initialInvitationStatusFilter?: string
  onAddKol: () => void
  onDelete: (id: string) => void
  onRefresh: () => void
}

const statusTone = (status: string) => {
  const map: Record<string, string> = {
    未首触: 'bg-gray-100 text-gray-600',
    已邀约: 'bg-purple-50 text-purple-700',
    待寄出: 'bg-amber-50 text-amber-700',
    运输中: 'bg-blue-50 text-blue-700',
    已签收: 'bg-cyan-50 text-cyan-700',
    内容跟进: 'bg-rose-50 text-rose-700',
    待制作: 'bg-amber-50 text-amber-700',
    制作中: 'bg-sky-50 text-sky-700',
    待发布: 'bg-indigo-50 text-indigo-700',
    暂停异常: 'bg-red-50 text-red-700',
    '暂停/异常': 'bg-red-50 text-red-700',
    异常: 'bg-red-50 text-red-700',
    合作完成: 'bg-emerald-50 text-emerald-700',
    拒绝合作: 'bg-red-50 text-red-700',
    我方拒绝: 'bg-slate-100 text-slate-600',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

const replyTone = (invitation: Invitation | null) => {
  if (!invitation) return 'bg-gray-100 text-gray-400'
  if (!invitation.replied || invitation.reply_result === '未回复') return 'bg-amber-50 text-amber-700'
  if (invitation.decision === '我方拒绝') return 'bg-slate-100 text-slate-600'
  if (invitation.reply_result.includes('同意')) return 'bg-emerald-50 text-emerald-700'
  if (invitation.reply_result.includes('拒绝')) return 'bg-red-50 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

const replyLabel = (invitation: Invitation | null) => {
  if (!invitation) return '无邀约'
  if (!invitation.replied || invitation.reply_result === '未回复') return '未回复'
  if (invitation.decision === '我方拒绝') return '不推进'
  if (invitation.reply_result.includes('同意')) return '已同意'
  if (invitation.reply_result.includes('拒绝')) return '已拒绝'
  return invitation.reply_result
}

const shipmentDateLabel = (kol: KOL) => {
  if (!kol.sample_date) return null
  if (kol.status === '待寄出') return `待寄 ${kol.sample_date}`
  if (kol.status === '运输中') return `已发出 ${kol.sample_date}`
  if (kol.status === '已签收') return `已签收 ${kol.sample_date}`
  if (kol.status === '合作完成') return `最近寄样 ${kol.sample_date}`
  return `寄样 ${kol.sample_date}`
}

const text = (value: unknown) => String(value ?? '').toLowerCase()

export default function KolTable({
  kols,
  invitations,
  shipments,
  collaborationsByKol,
  loading,
  onSelect,
  selectedId,
  productOptions,
  initialInvitationStatusFilter,
  onAddKol,
  onDelete,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState('')
  const [filterContentShape, setFilterContentShape] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterInvProduct, setFilterInvProduct] = useState('')
  const [filterInvStatus, setFilterInvStatus] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchInvite, setShowBatchInvite] = useState(false)
  const [batchProduct, setBatchProduct] = useState('')
  const [batchSending, setBatchSending] = useState(false)
  const [batchDone, setBatchDone] = useState(false)
  const [batchCopySucceeded, setBatchCopySucceeded] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const getLatestInv = (kolId: string): Invitation | null => {
    const invs = invitations[kolId] || []
    if (invs.length === 0) return null
    return invs.reduce((latest, inv) => !latest || inv.invited_at > latest.invited_at ? inv : latest)
  }

  const allTags = useMemo(() => {
    const set = new Set<string>()
    kols.forEach(kol => (kol.tags || []).forEach(tag => tag && set.add(tag)))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [kols])

  const allInvProducts = useMemo(() => collectProductOptions({ invitations }), [invitations])
  const allCollaborations = useMemo(() => Object.values(collaborationsByKol).flat(), [collaborationsByKol])

  useEffect(() => {
    if (initialInvitationStatusFilter) {
      setFilterInvStatus(initialInvitationStatusFilter)
    }
  }, [initialInvitationStatusFilter])

  const filtered = useMemo(() => {
    return kols.filter(kol => {
      const q = search.trim().toLowerCase()
      const matchSearch = !q ||
        text(kol.name).includes(q) ||
        text(kol.email).includes(q) ||
        text(kol.homepage_url).includes(q) ||
        text(kol.platform).includes(q) ||
        text(kol.country).includes(q) ||
        text(kol.followers).includes(q) ||
        (kol.tags || []).some(tag => text(tag).includes(q))
      const matchContentShape = !filterContentShape || getKolContentShape(kol) === filterContentShape
      const matchPlatform = !filterPlatform || kol.platform === filterPlatform
      const matchTag = !filterTag || (kol.tags || []).some(tag => text(tag) === filterTag.toLowerCase())

      const invs = invitations[kol.id] || []
      const matchInvProduct = !filterInvProduct || invs.some(inv => inv.product === filterInvProduct)
      const latest = getLatestInv(kol.id)
      let matchInvStatus = true
      if (filterInvStatus === 'none') matchInvStatus = !latest
      if (filterInvStatus === 'unreplied') {
        matchInvStatus = invs.some(invitation =>
          isActionablePendingInvitation(invitation, shipments, allCollaborations)
        )
      }
      if (filterInvStatus === 'agreed') matchInvStatus = Boolean(latest?.replied && latest.reply_result.includes('同意') && latest.decision !== '我方拒绝')
      if (filterInvStatus === 'rejected') matchInvStatus = Boolean(latest?.replied && (latest.reply_result.includes('拒绝') || latest.decision === '我方拒绝'))

      return matchSearch && matchContentShape && matchPlatform && matchTag && matchInvProduct && matchInvStatus
    })
  }, [kols, search, filterContentShape, filterPlatform, filterTag, filterInvProduct, filterInvStatus, invitations, shipments, allCollaborations])

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [search, filterContentShape, filterPlatform, filterTag, filterInvProduct, filterInvStatus, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const pageEnd = Math.min(safePage * pageSize, filtered.length)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const allPageSelected = paged.length > 0 && paged.every(kol => selectedIds.has(kol.id))
  const selectedKols = useMemo(() => kols.filter(kol => selectedIds.has(kol.id)), [kols, selectedIds])

  const stats = useMemo(() => ({
    total: kols.length,
    video: kols.filter(kol => getKolContentShape(kol) === '视频').length,
    website: kols.filter(kol => getKolContentShape(kol) === '网站').length,
    completed: Object.values(collaborationsByKol).reduce((sum, items) => sum + countCompletedCollaborations(items), 0),
  }), [kols, collaborationsByKol])

  const collaborationCount = (kolId: string) => countCompletedCollaborations(collaborationsByKol[kolId] || [])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) {
        paged.forEach(kol => next.delete(kol.id))
      } else {
        paged.forEach(kol => next.add(kol.id))
      }
      return next
    })
  }

  const handleBatchInvite = async () => {
    if (selectedKols.length === 0) return
    setBatchSending(true)
    try {
      const emails = selectedKols.map(k => k.email).filter(Boolean).join(', ')
      let clipboardCopied = false
      if (emails && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(emails)
          clipboardCopied = true
        } catch {
          clipboardCopied = false
        }
      }
      setBatchCopySucceeded(clipboardCopied)

      await Promise.all(selectedKols.map(async kol => {
        const inv = await createInvitation({
          kol_id: kol.id,
          product: batchProduct.trim(),
          invited_at: new Date().toISOString().slice(0, 10),
          email_subject: '',
          replied: false,
          reply_result: '',
          notes: '',
          quoted_fee: '',
          decision: '待评估',
          decision_reason: '',
        })
        const nextInvitations = [inv, ...(invitations[kol.id] || [])]
        const nextStatus = deriveKolStatus(
          kol,
          nextInvitations,
          shipments.filter(shipment => shipment.kol_id === kol.id),
          collaborationsByKol[kol.id] || []
        )
        if (nextStatus !== kol.status) {
          await updateKOL(kol.id, { status: nextStatus })
        }
      }))

      setBatchDone(true)
      setTimeout(() => {
        setShowBatchInvite(false)
        setBatchDone(false)
        setSelectedIds(new Set())
        onRefresh()
      }, 1400)
    } catch {
      alert('批量邀约失败，请重试')
    } finally {
      setBatchSending(false)
    }
  }

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        <div className="shrink-0 border-b border-black/[0.06] px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[220px] flex-1 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#1D1D1F] text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[17px] font-extrabold text-[#1D1D1F]">KOL 资源池</h2>
                <p className="mt-0.5 text-xs font-medium text-[#86868B]">共 {stats.total} 位，{filtered.length} 位符合当前筛选</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <MiniStat label="视频" value={stats.video} tone="text-[#0066FF]" />
              <MiniStat label="网站" value={stats.website} tone="text-[#FF9F0A]" />
              <MiniStat label="合作次" value={stats.completed} tone="text-[#34C759]" />
              <MiniStat label="已选择" value={selectedIds.size} tone="text-[#1D1D1F]" />
            </div>
            <button
              onClick={onRefresh}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-black/[0.08] bg-white px-3 text-xs font-bold text-[#6E6E73] transition hover:bg-[#F5F5F7]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> 刷新
            </button>
            <button
              onClick={onAddKol}
              className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#0066FF] px-4 text-xs font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.35)] transition active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" /> 添加 KOL
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[260px] flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#AEAEB2]" />
              <input
                type="text"
                placeholder="搜索名称 / 邮箱 / 主页 / 国家 / 标签"
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="h-9 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] pl-9 pr-3 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
              />
            </div>
            <FilterSelect value={filterContentShape} onChange={setFilterContentShape} options={CONTENT_SHAPES} placeholder="全部形态" />
            <FilterSelect value={filterPlatform} onChange={setFilterPlatform} options={PLATFORMS} placeholder="全部平台" />
            <FilterSelect value={filterTag} onChange={setFilterTag} options={allTags} placeholder="全部分类" />
            <FilterSelect value={filterInvProduct} onChange={setFilterInvProduct} options={allInvProducts} placeholder="邀约产品" />
            <select
              value={filterInvStatus}
              onChange={event => setFilterInvStatus(event.target.value)}
              className="h-9 rounded-[10px] border border-black/[0.08] bg-white px-3 text-xs font-bold text-[#6E6E73] outline-none focus:border-[#0066FF]/40"
            >
              <option value="">邀约结果</option>
              <option value="unreplied">未回复</option>
              <option value="agreed">已同意</option>
              <option value="rejected">已拒绝/不推进</option>
              <option value="none">无邀约</option>
            </select>
            {selectedIds.size > 0 && (
              <button
                onClick={() => { setBatchProduct(''); setShowBatchInvite(true) }}
                className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#1D1D1F] px-4 text-xs font-bold text-white transition active:scale-95"
              >
                <MailPlus className="h-3.5 w-3.5" /> 批量邀约 {selectedIds.size}
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-[1260px] w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#FBFBFD]">
              <tr className="border-b border-black/[0.06] text-[11px] font-bold text-[#86868B]">
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                  />
                </th>
                <th className="px-3 py-3">KOL</th>
                <th className="px-3 py-3">平台</th>
                <th className="px-3 py-3">内容形态</th>
                <th className="px-3 py-3">粉丝</th>
                <th className="px-3 py-3">当前流程</th>
                <th className="px-3 py-3">最近邀约</th>
                <th className="px-3 py-3">合作</th>
                <th className="px-3 py-3">邮箱</th>
                <th className="px-3 py-3">国家</th>
                <th className="px-3 py-3">标签</th>
                <th className="px-3 py-3">寄样</th>
                <th className="px-3 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loading ? (
                Array.from({ length: 6 }).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({ length: 13 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-3">
                        <div className="h-4 rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#F5F5F7] text-[#86868B]">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="mt-3 text-sm font-bold text-[#1D1D1F]">{kols.length === 0 ? '暂无 KOL 数据' : '没有匹配的 KOL'}</p>
                      {kols.length === 0 && (
                        <button onClick={onAddKol} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-[#0066FF] px-4 py-2 text-xs font-bold text-white">
                          <Plus className="h-3.5 w-3.5" /> 添加第一位 KOL
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paged.map(kol => {
                  const latestInvitation = getLatestInv(kol.id)
                  const count = collaborationCount(kol.id)
                  const contentShape = getKolContentShape(kol)
                  return (
                    <tr
                      key={kol.id}
                      className={`cursor-pointer transition hover:bg-[#F5F5F7] ${selectedId === kol.id ? 'bg-blue-50/70' : ''} ${selectedIds.has(kol.id) ? 'bg-gray-50' : ''}`}
                    >
                      <td className="px-4 py-3" onClick={event => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(kol.id)}
                          onChange={() => toggleSelect(kol.id)}
                          className="h-4 w-4 rounded border-gray-300 text-[#0066FF] focus:ring-[#0066FF]"
                        />
                      </td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-[11px] font-extrabold text-white">
                            {kol.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-extrabold text-[#1D1D1F]">{kol.name}</div>
                            <div className="truncate text-[11px] font-medium text-[#86868B]">{kol.homepage_url || '-'}</div>
                          </div>
                        </div>
                      </td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3 text-xs font-bold text-[#6E6E73]">{kol.platform || '-'}</td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${contentShape === '网站' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{contentShape}</span>
                      </td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3 text-xs font-semibold text-[#6E6E73]">{kol.followers || '-'}</td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(kol.status)}`}>{kol.status || '-'}</span>
                      </td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3">
                        <div className="flex max-w-[180px] flex-col gap-1">
                          <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${replyTone(latestInvitation)}`}>{replyLabel(latestInvitation)}</span>
                          {latestInvitation && <span className="truncate text-[11px] font-semibold text-[#86868B]">{latestInvitation.product}</span>}
                        </div>
                      </td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3">
                        {count > 0 ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{count} 次</span>
                        ) : <span className="text-xs font-medium text-[#AEAEB2]">-</span>}
                      </td>
                      <td onClick={() => onSelect(kol)} className="max-w-[190px] truncate px-3 py-3 text-xs font-medium text-[#6E6E73]">{kol.email || '-'}</td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3 text-xs font-medium text-[#6E6E73]">{kol.country || '-'}</td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3">
                        <div className="flex max-w-[180px] flex-wrap gap-1">
                          {(kol.tags || []).slice(0, 2).map(tag => <span key={tag} className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[11px] font-bold text-[#6E6E73]">{tag}</span>)}
                          {(kol.tags || []).length > 2 && <span className="text-[11px] font-bold text-[#AEAEB2]">+{kol.tags.length - 2}</span>}
                        </div>
                      </td>
                      <td onClick={() => onSelect(kol)} className="px-3 py-3">
                        {kol.sample_product || kol.sample_date ? (
                          <div className="max-w-[150px]">
                            {kol.sample_product && <div className="truncate text-[11px] font-bold text-amber-700">{kol.sample_product}</div>}
                            {kol.sample_date && <div className="text-[11px] font-medium text-[#86868B]">{shipmentDateLabel(kol)}</div>}
                          </div>
                        ) : <span className="text-xs font-medium text-[#AEAEB2]">-</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={event => { event.stopPropagation(); onDelete(kol.id) }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] text-[#AEAEB2] transition hover:bg-red-50 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-black/[0.06] bg-[#FBFBFD] px-5 py-3 text-xs font-semibold text-[#6E6E73]">
          <div>第 {pageStart}-{pageEnd} 条 / 共 {filtered.length} 条</div>
          <div className="flex items-center gap-2">
            <span>每页</span>
            <select value={pageSize} onChange={event => setPageSize(Number(event.target.value))} className="h-8 rounded-[8px] border border-black/[0.08] bg-white px-2 outline-none">
              {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={safePage <= 1} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-black/[0.08] bg-white disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-12 text-center">{safePage} / {totalPages}</span>
            <button onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-black/[0.08] bg-white disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {showBatchInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowBatchInvite(false)} />
          <div className="relative w-[520px] max-w-[calc(100vw-32px)] rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#1D1D1F]">批量邀约</h3>
                <p className="mt-1 text-xs font-medium text-[#86868B]">将复制邮箱，并为选中的 KOL 创建本次产品邀约记录。</p>
              </div>
              <span className="rounded-full bg-[#F5F5F7] px-3 py-1 text-xs font-extrabold text-[#1D1D1F]">{selectedKols.length} 位</span>
            </div>

            <div className="mt-5 rounded-[14px] border border-black/[0.06] bg-[#F5F5F7] p-3">
              <div className="flex flex-wrap gap-1.5">
                {selectedKols.slice(0, 10).map(kol => (
                  <span key={kol.id} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#6E6E73]">{kol.name}</span>
                ))}
                {selectedKols.length > 10 && <span className="px-2 py-1 text-[11px] font-bold text-[#86868B]">+{selectedKols.length - 10}</span>}
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-bold text-[#6E6E73]">邀约产品</label>
              <input
                type="text"
                value={batchProduct}
                onChange={event => setBatchProduct(event.target.value)}
                list={productOptions.length > 0 ? 'batch-invite-product-options' : undefined}
                placeholder="例如 BY53 / K1 / 防晒霜 SPF50+"
                className="h-10 w-full rounded-[10px] border border-black/[0.08] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
              {productOptions.length > 0 && (
                <datalist id="batch-invite-product-options">
                  {productOptions.map(product => <option key={product} value={product} />)}
                </datalist>
              )}
            </div>

            {batchDone ? (
              <div className="mt-5 rounded-[14px] bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {batchCopySucceeded ? '邮箱已复制，邀约记录已创建' : '邀约记录已创建，邮箱复制需手动处理'}
              </div>
            ) : (
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setShowBatchInvite(false)} className="h-10 rounded-[10px] px-4 text-sm font-bold text-[#6E6E73] transition hover:bg-[#F5F5F7]">取消</button>
                <button
                  onClick={handleBatchInvite}
                  disabled={batchSending || !batchProduct.trim()}
                  className="h-10 rounded-[10px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.35)] transition disabled:opacity-50"
                >
                  {batchSending ? '处理中...' : '确认邀约'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="min-w-16 rounded-[10px] bg-[#F5F5F7] px-3 py-2">
      <div className={`text-[15px] font-extrabold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-bold text-[#86868B]">{label}</div>
    </div>
  )
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      className="h-9 rounded-[10px] border border-black/[0.08] bg-white px-3 text-xs font-bold text-[#6E6E73] outline-none focus:border-[#0066FF]/40"
    >
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}
