import { ChevronDown, ChevronRight, ListFilter, MailPlus, Package, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { Collaboration, Invitation, KOL, Product, Shipment } from '../types'
import { createProduct, deleteProduct, updateProduct, type ProductInput } from '../services/productService'
import { deriveProductDraftsFromHistory } from '../utils/productExtraction'
import { mergeOpportunityProducts, sameProduct } from '../utils/productMatching'
import { buildProductOpportunitySummary, filterOpportunityRowsByStatus, type OpportunityStatus, type OpportunityStatusFilter } from '../utils/workspaceViews'
import { countProductDeletionReferences } from '../utils/productCorrection'
import { getAvatarTone, getTagTone } from '../utils/visualTone'
import { canonicalizeTags, collectTagOptions } from '../utils/tags'
import TagSelector from './TagSelector'
import ProductBatchInviteModal from './ProductBatchInviteModal'

interface Props {
  products: Product[]
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
  productOptions: string[]
  onProductsChange: () => Promise<void> | void
  onDataChange: () => Promise<void> | void
  onSelectKol: (kol: KOL) => void
}

const statusTone: Record<OpportunityStatus, string> = {
  未触达: 'bg-gray-100 text-gray-600',
  待回复: 'bg-amber-50 text-amber-700',
  未回复: 'bg-violet-50 text-violet-700',
  已同意: 'bg-blue-50 text-blue-700',
  已拒绝: 'bg-red-50 text-red-700',
  不推进: 'bg-slate-100 text-slate-600',
  寄样中: 'bg-cyan-50 text-cyan-700',
  内容中: 'bg-rose-50 text-rose-700',
  已完成: 'bg-emerald-50 text-emerald-700',
}

const statusDot: Record<OpportunityStatus, string> = {
  未触达: 'bg-gray-300',
  待回复: 'bg-[#FFB000]',
  未回复: 'bg-violet-500',
  已同意: 'bg-[#0066FF]',
  已拒绝: 'bg-[#FF3B30]',
  不推进: 'bg-slate-400',
  寄样中: 'bg-cyan-500',
  内容中: 'bg-rose-500',
  已完成: 'bg-[#34C759]',
}

const statusOrder: OpportunityStatus[] = ['未触达', '待回复', '已同意', '寄样中', '内容中', '已完成', '未回复', '已拒绝', '不推进']

const fmtFollowers = (value: string) => value?.trim() || '-'

interface ProductFormState {
  name: string
  target_kol_tags: string[]
  notes: string
}

const emptyProductForm: ProductFormState = {
  name: '',
  target_kol_tags: [],
  notes: '',
}

function formFromProduct(product: Product, tagOptions: string[]): ProductFormState {
  return {
    name: product.name,
    target_kol_tags: canonicalizeTags(product.target_kol_tags || [], tagOptions),
    notes: product.notes || '',
  }
}

function productPayloadFromForm(form: ProductFormState): ProductInput {
  return {
    name: form.name.trim(),
    category: '',
    target_kol_tags: canonicalizeTags(form.target_kol_tags),
    target_content_shapes: [],
    status: '在推',
    priority: 0,
    notes: form.notes.trim(),
  }
}

export default function ProductOpportunityView({ products, kols, invitations, shipments, collaborationsByKol, productOptions, onProductsChange, onDataChange, onSelectKol }: Props) {
  const [selectedProduct, setSelectedProduct] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<OpportunityStatusFilter>('全部')
  const [showUntouched, setShowUntouched] = useState(false)
  const [selectedKolIds, setSelectedKolIds] = useState<Set<string>>(new Set())
  const [showBatchInvite, setShowBatchInvite] = useState(false)
  const opportunityProducts = useMemo(
    () => mergeOpportunityProducts(products, productOptions),
    [products, productOptions]
  )

  const summary = useMemo(() => buildProductOpportunitySummary({
    products: opportunityProducts,
    kols,
    invitations,
    shipments,
    collaborationsByKol,
  }), [opportunityProducts, kols, invitations, shipments, collaborationsByKol])

  useEffect(() => {
    const names = summary.map(item => item.product)
    if (!selectedProduct && names[0]) setSelectedProduct(names[0])
    if (selectedProduct && names.length > 0 && !names.includes(selectedProduct)) setSelectedProduct(names[0])
  }, [summary, selectedProduct])

  useEffect(() => {
    setShowUntouched(false)
    setSelectedKolIds(new Set())
  }, [selectedProduct])

  const selected = summary.find(item => item.product === selectedProduct) || summary[0]
  const q = query.trim().toLowerCase()
  const queryFilteredRows = selected?.rows.filter(row => {
    if (!q) return true
    return [
      row.kol.name,
      row.kol.country,
      row.kol.platform,
      row.kol.followers,
      ...(row.kol.tags || []),
    ].some(value => String(value || '').toLowerCase().includes(q))
  }) || []
  const statusCounts = statusOrder.reduce<Record<OpportunityStatus, number>>((counts, status) => {
    counts[status] = queryFilteredRows.filter(row => row.status === status).length
    return counts
  }, {} as Record<OpportunityStatus, number>)
  const filteredRows = filterOpportunityRowsByStatus(queryFilteredRows, statusFilter)
  const selectedKols = kols.filter(kol => selectedKolIds.has(kol.id) && !kol.blacklisted_at)
  const selectableFilteredKols = filteredRows.map(row => row.kol).filter(kol => !kol.blacklisted_at)
  const allFilteredSelected = selectableFilteredKols.length > 0 && selectableFilteredKols.every(kol => selectedKolIds.has(kol.id))
  const toggleSelectedKol = (kol: KOL) => {
    if (kol.blacklisted_at) return
    setSelectedKolIds(current => {
      const next = new Set(current)
      if (next.has(kol.id)) next.delete(kol.id)
      else next.add(kol.id)
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-black/[0.06] bg-white px-8 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {summary.map(item => (
              <button
                key={item.product}
                onClick={() => setSelectedProduct(item.product)}
                className={`shrink-0 rounded-[12px] px-4 py-2 text-xs font-extrabold transition ${selected?.product === item.product ? 'bg-[#1D1D1F] text-white shadow-sm' : 'bg-[#F5F5F7] text-[#6E6E73] hover:bg-gray-200'}`}
              >
                {item.product}
              </button>
            ))}
          </div>
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#AEAEB2]" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索 KOL / 国家 / 标签"
              className="h-10 w-full rounded-[12px] border border-black/[0.08] bg-[#F5F5F7] pl-9 pr-3 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {selected && (
        <div className="shrink-0 border-b border-black/[0.06] bg-white px-8 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setStatusFilter('全部')}
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition ${statusFilter === '全部' ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#6E6E73] hover:bg-gray-200'}`}
            >
              <ListFilter className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold">全部</span>
              <span className={`text-xs font-extrabold tabular-nums ${statusFilter === '全部' ? 'text-white' : 'text-[#1D1D1F]'}`}>{queryFilteredRows.length}</span>
            </button>
            {statusOrder.map(status => {
              const count = statusCounts[status]
              const active = statusFilter === status
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition ${active ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#6E6E73] hover:bg-gray-200'}`}
                >
                  <span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />
                  <span className="text-[11px] font-bold">{status}</span>
                  <span className={`text-xs font-extrabold tabular-nums ${active ? 'text-white' : 'text-[#1D1D1F]'}`}>{count}</span>
                </button>
              )
            })}
            {selectableFilteredKols.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedKolIds(current => {
                    const next = new Set(current)
                    if (allFilteredSelected) selectableFilteredKols.forEach(kol => next.delete(kol.id))
                    else selectableFilteredKols.forEach(kol => next.add(kol.id))
                    return next
                  })}
                  className="h-8 rounded-[9px] bg-[#F5F5F7] px-3 text-[11px] font-bold text-[#6E6E73] hover:bg-gray-200"
                >
                  {allFilteredSelected ? '取消全选' : `全选当前 ${selectableFilteredKols.length}`}
                </button>
                {selectedKols.length > 0 && (
                  <>
                <button type="button" onClick={() => setSelectedKolIds(new Set())} className="h-8 rounded-[9px] px-3 text-[11px] font-bold text-[#86868B] hover:bg-[#F5F5F7]">清除 {selectedKols.length}</button>
                <button type="button" onClick={() => setShowBatchInvite(true)} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#0066FF] px-3 text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.25)]">
                  <MailPlus className="h-3.5 w-3.5" /> 批量邀约
                </button>
                  </>
                )}
              </div>
            )}
            <span className="ml-auto text-xs font-bold text-[#86868B]">共 {filteredRows.length} 位 KOL</span>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden px-8 py-5">
        <div className="grid h-full min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_560px] 2xl:grid-cols-[minmax(0,1fr)_640px]">
          <div className="min-h-0 overflow-y-auto pr-1">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center text-[#86868B]">
            <Package className="mb-3 h-8 w-8" />
            <div className="text-sm font-bold">暂无产品机会</div>
          </div>
        ) : (
          <div className="space-y-7">
            {statusOrder.map(status => {
              const rows = filteredRows.filter(row => row.status === status)
              if (rows.length === 0) return null
              const collapsedUntouched = status === '未触达' && statusFilter === '全部' && !showUntouched

              if (collapsedUntouched) {
                return (
                  <section key={status}>
                    <button
                      type="button"
                      onClick={() => setShowUntouched(true)}
                      className="flex w-full items-center gap-2 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3 text-left shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:border-[#0066FF]/30"
                    >
                      <ChevronRight className="h-4 w-4 text-[#86868B]" />
                      <span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />
                      <span className="text-sm font-extrabold text-[#1D1D1F]">{status}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[status]}`}>{rows.length}</span>
                      <span className="ml-auto text-xs font-bold text-[#86868B]">展开</span>
                    </button>
                  </section>
                )
              }

              return (
                <section key={status}>
                  <div className="mb-3 flex items-center gap-2">
                    {status === '未触达' && statusFilter === '全部' && (
                      <button
                        type="button"
                        onClick={() => setShowUntouched(false)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#F5F5F7] text-[#86868B] transition hover:bg-gray-200"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    )}
                    <span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />
                    <h3 className="text-sm font-extrabold text-[#1D1D1F]">{status}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[status]}`}>{rows.length}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {rows.map(row => {
                      const invitationCount = (invitations[row.kol.id] || []).filter(invitation => sameProduct(invitation.product, selected.product)).length
                      const checked = selectedKolIds.has(row.kol.id)
                      return (
                      <article
                        key={`${selected.product}-${row.kol.id}-${status}`}
                        className={`relative rounded-[14px] border bg-white p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:shadow-md ${checked ? 'border-[#0066FF]/50 ring-2 ring-blue-50' : 'border-black/[0.06] hover:border-[#0066FF]/30'} ${status === '未回复' || status === '已拒绝' || status === '不推进' ? 'opacity-65' : ''}`}
                      >
                        <button type="button" onClick={() => toggleSelectedKol(row.kol)} disabled={Boolean(row.kol.blacklisted_at)} className="absolute right-3 top-3 z-10" title={row.kol.blacklisted_at ? '已拉黑，不能邀约' : '选择邀约'}>
                          <span className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold ${checked ? 'border-[#0066FF] bg-[#0066FF] text-white' : 'border-black/15 bg-white text-transparent'} ${row.kol.blacklisted_at ? 'cursor-not-allowed opacity-30' : ''}`}>✓</span>
                        </button>
                        <button type="button" onClick={() => onSelectKol(row.kol)} className="block w-full pr-7 text-left">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${getAvatarTone(row.kol.name)}`}>
                            {row.kol.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-extrabold text-[#1D1D1F]">{row.kol.name}</div>
                            <div className="mt-0.5 truncate text-[11px] font-semibold text-[#86868B]">{row.kol.platform} · {fmtFollowers(row.kol.followers)} · {row.kol.country || '-'}</div>
                            {invitationCount > 1 && <div className="mt-1 text-[10px] font-extrabold text-[#0066FF]">第 {invitationCount} 次邀约</div>}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {(row.kol.tags || []).slice(0, 3).map(tag => (
                            <span key={tag} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${getTagTone(tag)}`}>{tag}</span>
                          ))}
                          {(row.kol.tags || []).length === 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[11px] font-bold text-[#AEAEB2]">
                              <UserRound className="h-3 w-3" /> 未分类
                            </span>
                          )}
                        </div>
                        </button>
                      </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}

            {filteredRows.length === 0 && (
              <div className="flex h-64 flex-col items-center justify-center rounded-[18px] border border-dashed border-black/[0.08] bg-white text-center">
                <Search className="mb-3 h-6 w-6 text-[#AEAEB2]" />
                <div className="text-sm font-extrabold text-[#1D1D1F]">没有匹配结果</div>
              </div>
            )}
          </div>
        )}
          </div>
          <ProductLibraryPanel
            products={products}
            kols={kols}
            invitations={invitations}
            shipments={shipments}
            collaborationsByKol={collaborationsByKol}
            onProductsChange={onProductsChange}
            onSelectProduct={setSelectedProduct}
          />
        </div>
      </div>
      {showBatchInvite && selected && (
        <ProductBatchInviteModal
          kols={selectedKols}
          product={selected.product}
          invitations={invitations}
          shipments={shipments}
          collaborationsByKol={collaborationsByKol}
          onClose={() => setShowBatchInvite(false)}
          onComplete={failedKolIds => setSelectedKolIds(new Set(failedKolIds))}
          onDataChange={onDataChange}
        />
      )}
    </div>
  )
}

function ProductLibraryPanel({
  products,
  kols,
  invitations,
  shipments,
  collaborationsByKol,
  onProductsChange,
  onSelectProduct,
}: {
  products: Product[]
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
  onProductsChange: () => Promise<void> | void
  onSelectProduct: (productName: string) => void
}) {
  const [form, setForm] = useState<ProductFormState>(emptyProductForm)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const operationalProducts = products.filter(product => product.status !== '归档')
  const tagOptions = useMemo(
    () => collectTagOptions(kols.flatMap(kol => kol.tags || [])),
    [kols]
  )
  const importCandidates = useMemo(() => deriveProductDraftsFromHistory({
    existingProducts: products,
    kols,
    invitations,
    shipments,
    collaborationsByKol,
  }), [products, kols, invitations, shipments, collaborationsByKol])
  const resetForm = () => {
    setEditingProduct(null)
    setForm(emptyProductForm)
    setMessage('')
  }

  const startEdit = (product: Product) => {
    setEditingProduct(product)
    setForm(formFromProduct(product, tagOptions))
    setMessage('')
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const payload = productPayloadFromForm(form)

    if (!payload.name) {
      setMessage('产品名称不能为空')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      const saved = editingProduct
        ? await updateProduct(editingProduct.id, payload)
        : await createProduct(payload)

      await onProductsChange()
      onSelectProduct(saved.name)
      setEditingProduct(null)
      setForm(emptyProductForm)
      setMessage(editingProduct ? '产品已更新' : '产品已新增')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const removeProduct = async (product: Product) => {
    const references = countProductDeletionReferences(
      product,
      products,
      {
        invitations: Object.values(invitations).flat(),
        shipments,
        collaborations: Object.values(collaborationsByKol).flat(),
      }
    )

    if (references.total > 0) {
      setMessage(`无法删除「${product.name}」：还有邀约 ${references.invitations}、寄样 ${references.shipments}、合作 ${references.collaborations} 条引用。请先在对应 KOL 档案中修正产品。`)
      return
    }

    if (!confirm(`永久删除产品「${product.name}」？此操作无法撤销。`)) return

    setSaving(true)
    setMessage('')
    try {
      await deleteProduct(product)
      await onProductsChange()
      if (editingProduct?.id === product.id) resetForm()
      setMessage('产品已删除')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败')
    } finally {
      setSaving(false)
    }
  }

  const importHistoricalProducts = async () => {
    if (importCandidates.length === 0) {
      setMessage('没有可提取的历史产品')
      return
    }
    if (!confirm(`从历史记录提取 ${importCandidates.length} 个产品到产品库？`)) return

    setSaving(true)
    setMessage('')
    try {
      const created: Product[] = []
      for (const candidate of importCandidates) {
        created.push(await createProduct(candidate))
      }
      await onProductsChange()
      if (created[0]) onSelectProduct(created[0].name)
      setMessage(`已提取 ${created.length} 个历史产品`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提取失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
        <div>
          <div className="text-sm font-extrabold text-[#1D1D1F]">产品库</div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#86868B]">{operationalProducts.length} 个产品</div>
        </div>
        <div className="flex items-center gap-2">
          {importCandidates.length > 0 && (
            <button
              type="button"
              onClick={importHistoricalProducts}
              disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#F5F5F7] px-3 text-[11px] font-bold text-[#1D1D1F] transition hover:bg-gray-200 disabled:opacity-60"
            >
              <Package className="h-3.5 w-3.5" /> 提取 {importCandidates.length}
            </button>
          )}
          {editingProduct && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#F5F5F7] px-3 text-[11px] font-bold text-[#6E6E73] transition hover:bg-gray-200"
            >
              <X className="h-3.5 w-3.5" /> 取消
            </button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="space-y-3 border-b border-black/[0.06] px-5 py-4 xl:min-h-0 xl:overflow-y-auto xl:border-b-0 xl:border-r">
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-[#86868B]">产品名称</span>
            <input
              value={form.name}
              onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
              className="h-9 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
            />
          </label>
          <div>
            <span className="mb-1 block text-[11px] font-bold text-[#86868B]">目标 KOL 标签</span>
            <TagSelector
              value={form.target_kol_tags}
              options={tagOptions}
              onChange={target_kol_tags => setForm(current => ({ ...current, target_kol_tags }))}
              allowCreate={false}
              placeholder="搜索现有 KOL 标签"
              selectedAreaClassName="min-h-[76px]"
            />
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-[#86868B]">备注</span>
            <textarea
              value={form.notes}
              onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
              rows={2}
              className="w-full resize-none rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#0066FF] px-3 text-xs font-extrabold text-white shadow-[0_2px_8px_rgba(0,102,255,0.25)] transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editingProduct ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {editingProduct ? '保存产品' : '新增产品'}
          </button>
        </div>
        {message && <div className="text-[11px] font-bold text-[#6E6E73]">{message}</div>}
      </form>

      <div className="min-h-0 overflow-y-auto px-5 py-4">
        {operationalProducts.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-black/[0.08] bg-[#F5F5F7] px-4 py-6 text-center">
            <Package className="mx-auto mb-2 h-5 w-5 text-[#AEAEB2]" />
            <div className="text-xs font-extrabold text-[#1D1D1F]">暂无产品</div>
            {importCandidates.length > 0 && (
              <button
                type="button"
                onClick={importHistoricalProducts}
                disabled={saving}
                className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] bg-[#1D1D1F] px-3 text-[11px] font-bold text-white transition disabled:opacity-60"
              >
                <Package className="h-3.5 w-3.5" /> 提取历史产品
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {operationalProducts.map(product => {
              return (
                <div key={product.id} className="rounded-[12px] border border-black/[0.06] bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => onSelectProduct(product.name)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-xs font-extrabold text-[#1D1D1F]" title={product.name}>{product.name}</div>
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {(product.target_kol_tags || []).slice(0, 4).map(tag => (
                      <span key={tag} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getTagTone(tag)}`}>{tag}</span>
                    ))}
                    {(product.target_kol_tags || []).length === 0 && <span className="text-[10px] font-semibold text-[#AEAEB2]">适用于全部标签</span>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                      className="inline-flex h-7 min-w-[72px] flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[#F5F5F7] text-[11px] font-bold text-[#1D1D1F] transition hover:bg-gray-200"
                    >
                      <Pencil className="h-3.5 w-3.5" /> 编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProduct(product)}
                      className="inline-flex h-7 min-w-[72px] flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-red-50 text-[11px] font-bold text-red-600 transition hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> 删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </div>
    </aside>
  )
}
