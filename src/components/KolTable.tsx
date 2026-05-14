import { useState, useMemo, useEffect } from 'react'
import { Collaboration, KOL, Invitation, STATUSES, PLATFORMS } from '../types'
import { createInvitation } from '../services/invitationService'
import { updateKOL } from '../services/kolService'
import AddKolModal, { KolFormData } from './AddKolModal'
import { countCompletedCollaborations } from '../utils/kolStatus'

interface Props {
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  collaborationsByKol: Record<string, Collaboration[]>
  loading: boolean
  onSelect: (kol: KOL) => void
  selectedId: string | null
  onCreate: (data: KolFormData) => void
  onDelete: (id: string) => void
  onRefresh: () => void
}

export default function KolTable({ kols, invitations, collaborationsByKol, loading, onSelect, selectedId, onCreate, onDelete, onRefresh }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [filterInvProduct, setFilterInvProduct] = useState('')
  const [filterInvStatus, setFilterInvStatus] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchInvite, setShowBatchInvite] = useState(false)
  const [batchProduct, setBatchProduct] = useState('')
  const [batchSending, setBatchSending] = useState(false)
  const [batchDone, setBatchDone] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const getLatestInv = (kolId: string): Invitation | null => {
    const invs = invitations[kolId] || []
    if (invs.length === 0) return null
    return invs.reduce((latest, inv) => !latest || inv.invited_at > latest.invited_at ? inv : latest)
  }

  // Get all unique tags from existing KOL data for filtering
  const allTags = useMemo(() => {
    const set = new Set<string>()
    kols.forEach(kol => (kol.tags || []).forEach(tag => tag && set.add(tag)))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [kols])

  const allInvProducts = useMemo(() => {
    const set = new Set<string>()
    Object.values(invitations).forEach(invs => invs.forEach(inv => set.add(inv.product)))
    return [...set].sort()
  }, [invitations])

  const allCountries = useMemo(() => {
    const set = new Set<string>()
    kols.forEach(kol => {
      const country = String(kol.country || '').trim()
      if (country) set.add(country)
    })
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [kols])

  const filtered = useMemo(() => {
    const text = (value: unknown) => String(value ?? '').toLowerCase()
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
      const matchStatus = !filterStatus || kol.status === filterStatus
      const matchPlatform = !filterPlatform || kol.platform === filterPlatform
      const matchTag = !filterTag || (kol.tags || []).some(t => text(t) === filterTag.toLowerCase())

      let matchInvProduct = true
      if (filterInvProduct) {
        const invs = invitations[kol.id] || []
        matchInvProduct = invs.some(inv => inv.product === filterInvProduct)
      }

      let matchInvStatus = true
      if (filterInvStatus) {
        const latest = getLatestInv(kol.id)
        if (!latest) matchInvStatus = filterInvStatus === 'none'
        else if (filterInvStatus === 'unreplied') matchInvStatus = !latest.replied
        else if (filterInvStatus === 'agreed') matchInvStatus = latest.replied && latest.reply_result.includes('同意')
        else if (filterInvStatus === 'rejected') matchInvStatus = latest.replied && latest.reply_result.includes('拒绝')
      }

      return matchSearch && matchStatus && matchPlatform && matchTag && matchInvProduct && matchInvStatus
    })
  }, [kols, search, filterStatus, filterPlatform, filterTag, filterInvProduct, filterInvStatus, invitations])

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [search, filterStatus, filterPlatform, filterTag, filterInvProduct, filterInvStatus, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const pageEnd = Math.min(safePage * pageSize, filtered.length)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const collaborationCount = (kolId: string) => countCompletedCollaborations(collaborationsByKol[kolId] || [])

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      '已邀约': 'bg-purple-100 text-purple-700',
      '待寄出': 'bg-orange-100 text-orange-700', '运输中': 'bg-blue-100 text-blue-700',
      '内容跟进': 'bg-rose-100 text-rose-700', '异常': 'bg-red-100 text-red-700',
      '已签收': 'bg-teal-100 text-teal-700', '待制作': 'bg-amber-100 text-amber-700',
      '制作中': 'bg-sky-100 text-sky-700', '待发布': 'bg-cyan-100 text-cyan-700',
      '进度异常': 'bg-red-100 text-red-700', '合作完成': 'bg-green-100 text-green-700',
      '拒绝合作': 'bg-red-100 text-red-700',
    }
    return map[s] || 'bg-gray-100 text-gray-600'
  }

  const invMiniBadge = (inv: Invitation | null) => {
    if (!inv) return <span className="text-[11px] text-gray-300">-</span>
    const color = !inv.replied
      ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
      : inv.reply_result.includes('同意')
        ? 'bg-green-50 text-green-700 border-green-200'
        : inv.reply_result.includes('拒绝')
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-yellow-50 text-yellow-700 border-yellow-200'
    const label = !inv.replied ? '未回复' : inv.reply_result.includes('同意') ? '已同意' : inv.reply_result.includes('拒绝') ? '已拒绝' : inv.reply_result
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-purple-600">{inv.product}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded border ${color}`}>{label}</span>
      </div>
    )
  }

  // ─── Batch invite logic ───────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === paged.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paged.map(k => k.id)))
    }
  }

  const selectedKols = kols.filter(k => selectedIds.has(k.id))
  const INVITATION_ENTRY_STATUSES = ['未首触', '拒绝合作', '沟通中', '未回复', '']

  const shipmentDateLabel = (kol: KOL) => {
    if (!kol.sample_date) return null
    if (kol.status === '待寄出') return `待寄 ${kol.sample_date}`
    if (kol.status === '运输中') return `已发出 ${kol.sample_date}`
    if (kol.status === '已签收') return `已签收 ${kol.sample_date}`
    if (kol.status === '合作完成') return `最近寄样 ${kol.sample_date}`
    return `寄样日期 ${kol.sample_date}`
  }

  const handleBatchInvite = async () => {
    if (selectedKols.length === 0) return
    setBatchSending(true)
    try {
      // 1. Copy emails to clipboard
      const emails = selectedKols.map(k => k.email).filter(Boolean).join(', ')
      await navigator.clipboard.writeText(emails)

      // 2. Create invitation records for each selected KOL and advance only early-stage KOLs
      await Promise.all(selectedKols.map(async k => {
        await createInvitation({
          kol_id: k.id,
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
        if (INVITATION_ENTRY_STATUSES.includes(k.status)) {
          await updateKOL(k.id, { status: '已邀约' })
        }
      }))

      setBatchDone(true)
      setTimeout(() => {
        setShowBatchInvite(false)
        setBatchDone(false)
        setSelectedIds(new Set())
        onRefresh()
      }, 2000)
    } catch {
      alert('批量邀约失败，请重试')
    } finally {
      setBatchSending(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-semibold text-gray-900">KOL 资源池</h1>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button
                  onClick={() => { setBatchProduct(''); setShowBatchInvite(true) }}
                  className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm rounded-lg hover:from-purple-600 hover:to-purple-700 shadow-sm transition-all font-medium"
                >
                  📩 批量邀约 ({selectedIds.size})
                </button>
              )}
              <button onClick={onRefresh} className="text-xs text-gray-400 hover:text-blue-500 transition-colors">刷新</button>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{kols.length} 条</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <input type="text" placeholder="搜索名称 / 邮箱 / 主页..." value={search} onChange={e => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50" />
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
                <option value="">全部状态</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg">
                <option value="">全部平台</option>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="px-3 py-1.5 text-sm border border-emerald-200 rounded-lg text-emerald-700 bg-emerald-50/40">
                <option value="">全部分类</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={() => setShowAddModal(true)} className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg hover:from-blue-600 hover:to-blue-700 shadow-sm transition-all shrink-0">
                + 新增 KOL
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select value={filterInvProduct} onChange={e => setFilterInvProduct(e.target.value)} className="px-3 py-1.5 text-xs border border-purple-200 rounded-lg text-purple-700">
                <option value="">全部邀约产品</option>
                {allInvProducts.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterInvStatus} onChange={e => setFilterInvStatus(e.target.value)} className="px-3 py-1.5 text-xs border border-purple-200 rounded-lg text-purple-700">
                <option value="">全部邀约状态</option>
                <option value="unreplied">未回复</option>
                <option value="agreed">已同意</option>
                <option value="rejected">已拒绝</option>
                <option value="none">无邀约记录</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-3 py-3 w-[40px]">
                  <input
                    type="checkbox"
                    checked={paged.length > 0 && selectedIds.size === paged.length && paged.every(k => selectedIds.has(k.id))}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[12%]">博主名称</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[8%]">平台</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[7%]">粉丝</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[9%]">状态</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[10%]">最近邀约</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[9%]">合作次数</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[16%]">联系邮箱</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[7%]">国家</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[9%]">标签</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[8%]">寄样</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 w-[5%]">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-16 text-gray-400">
                    {kols.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm">还没有任何 KOL 数据</p>
                        <button onClick={() => setShowAddModal(true)} className="text-blue-500 text-sm">点击新增第一个 KOL</button>
                      </div>
                    ) : <p className="text-sm">无匹配结果</p>}
                  </td>
                </tr>
              ) : (
                paged.map(kol => (
                  <tr key={kol.id} className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-blue-50/50 ${selectedId === kol.id ? 'bg-blue-50' : ''} ${selectedIds.has(kol.id) ? 'bg-purple-50/40' : ''}`}>
                    <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(kol.id)}
                        onChange={() => toggleSelect(kol.id)}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                    <td onClick={() => onSelect(kol)} className="px-4 py-3 font-semibold text-blue-600">{kol.name}</td>
                    <td onClick={() => onSelect(kol)} className="px-4 py-3 text-gray-700">{kol.platform}</td>
                    <td onClick={() => onSelect(kol)} className="px-4 py-3 text-gray-700">{kol.followers}</td>
                    <td onClick={() => onSelect(kol)} className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(kol.status)}`}>{kol.status}</span>
                    </td>
                    <td onClick={() => onSelect(kol)} className="px-4 py-3">{invMiniBadge(getLatestInv(kol.id))}</td>
                    <td onClick={() => onSelect(kol)} className="px-4 py-3">
                      {collaborationCount(kol.id) > 0 ? (
                        <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full text-xs font-semibold">合作 {collaborationCount(kol.id)} 次</span>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td onClick={() => onSelect(kol)} className="px-4 py-3 text-gray-500 text-sm">{kol.email}</td>
                    <td onClick={() => onSelect(kol)} className="px-4 py-3 text-gray-600 text-sm">{kol.country}</td>
                    <td onClick={() => onSelect(kol)} className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(kol.tags || []).slice(0, 2).map(t => <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{t}</span>)}
                        {(kol.tags || []).length > 2 && <span className="text-xs text-gray-400">+{kol.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {kol.sample_product || kol.sample_date ? (
                        <div className="space-y-0.5">
                          {kol.sample_product && <div className="text-xs font-medium text-orange-600 truncate">{kol.sample_product}</div>}
                          {kol.sample_date && <div className="text-xs text-green-600">{shipmentDateLabel(kol)}</div>}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={(e) => { e.stopPropagation(); onDelete(kol.id) }} className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium">删除</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/70 text-sm text-gray-600">
          <div>第 {pageStart}-{pageEnd} 条 / 共 {filtered.length} 条</div>
          <div className="flex items-center gap-2">
            <span>每页</span>
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="px-2 py-1 border border-gray-200 rounded-lg bg-white">
              {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="px-3 py-1 border border-gray-200 rounded-lg bg-white disabled:opacity-40">上一页</button>
            <span className="px-2">{safePage} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="px-3 py-1 border border-gray-200 rounded-lg bg-white disabled:opacity-40">下一页</button>
          </div>
        </div>
      </div>
      {showAddModal && <AddKolModal existingKols={kols} countryOptions={allCountries} onClose={() => setShowAddModal(false)} onSubmit={(data) => { onCreate(data); setShowAddModal(false) }} />}

      {/* Batch Invite Modal */}
      {showBatchInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setShowBatchInvite(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[480px] max-h-[80vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📩 批量邀约</h3>

            <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-xs text-purple-700 font-medium mb-1">已选 {selectedKols.length} 位 KOL</p>
              <div className="flex flex-wrap gap-1">
                {selectedKols.slice(0, 8).map(k => (
                  <span key={k.id} className="text-[10px] px-2 py-0.5 bg-white rounded-full border border-purple-200 text-purple-600">{k.name}</span>
                ))}
                {selectedKols.length > 8 && <span className="text-[10px] text-purple-400">+{selectedKols.length - 8} 更多</span>}
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">邀约产品</label>
                <input
                  type="text"
                  value={batchProduct}
                  onChange={e => setBatchProduct(e.target.value)}
                  placeholder="手动输入产品名称，如 BY53"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-400/50 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-gray-400">这里仅记录本次邀约对应的产品，不会自动发送邮件。</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-1">点击确认后将：</p>
              <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
                <li>复制所有选中 KOL 的邮箱到剪贴板</li>
                <li>为每位 KOL 创建邀约记录</li>
                <li>你可以直接粘贴邮箱去发邮件</li>
              </ul>
            </div>

            {batchDone ? (
              <div className="text-center py-3">
                <p className="text-green-600 font-medium">✅ 邮箱已复制，邀约记录已创建！</p>
                <p className="text-xs text-gray-500 mt-1">请前往邮箱客户端粘贴收件人发送邮件</p>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowBatchInvite(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
                <button onClick={handleBatchInvite} disabled={batchSending || !batchProduct.trim()}
                  className="px-5 py-2 text-sm bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 shadow-sm transition-all font-medium disabled:opacity-50">
                  {batchSending ? '处理中...' : `确认邀约 (${selectedKols.length} 人)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
