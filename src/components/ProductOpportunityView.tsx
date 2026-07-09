import { Archive, Check, Package, Pencil, Plus, Search, UserRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { Collaboration, Invitation, KOL, Product, Shipment } from '../types'
import { createProduct, updateProduct, type ProductInput } from '../services/productService'
import { CONTENT_SHAPES } from '../utils/contentShape'
import { mergeOpportunityProducts } from '../utils/productMatching'
import { buildProductOpportunitySummary, type OpportunityStatus } from '../utils/workspaceViews'

interface Props {
  products: Product[]
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
  productOptions: string[]
  onProductsChange: () => Promise<void> | void
  onSelectKol: (kol: KOL) => void
}

const statusTone: Record<OpportunityStatus, string> = {
  未触达: 'bg-gray-100 text-gray-600',
  待回复: 'bg-amber-50 text-amber-700',
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
  已同意: 'bg-[#0066FF]',
  已拒绝: 'bg-[#FF3B30]',
  不推进: 'bg-slate-400',
  寄样中: 'bg-cyan-500',
  内容中: 'bg-rose-500',
  已完成: 'bg-[#34C759]',
}

const statusOrder: OpportunityStatus[] = ['未触达', '待回复', '已同意', '寄样中', '内容中', '已完成', '已拒绝', '不推进']

const fmtFollowers = (value: string) => value?.trim() || '-'

const PRODUCT_STATUSES = ['在推', '暂停', '归档']

interface ProductFormState {
  name: string
  category: string
  target_kol_tags: string
  target_content_shapes: string[]
  status: string
  priority: string
  notes: string
}

const emptyProductForm: ProductFormState = {
  name: '',
  category: '',
  target_kol_tags: '',
  target_content_shapes: [...CONTENT_SHAPES],
  status: '在推',
  priority: '50',
  notes: '',
}

function formFromProduct(product: Product): ProductFormState {
  return {
    name: product.name,
    category: product.category || '',
    target_kol_tags: (product.target_kol_tags || []).join(', '),
    target_content_shapes: product.target_content_shapes?.length ? product.target_content_shapes : [...CONTENT_SHAPES],
    status: product.status || '在推',
    priority: String(product.priority ?? 0),
    notes: product.notes || '',
  }
}

function productPayloadFromForm(form: ProductFormState): ProductInput {
  return {
    name: form.name.trim(),
    category: form.category.trim(),
    target_kol_tags: form.target_kol_tags.split(',').map(tag => tag.trim()).filter(Boolean),
    target_content_shapes: form.target_content_shapes,
    status: form.status,
    priority: Number.isFinite(Number(form.priority)) ? Number(form.priority) : 0,
    notes: form.notes.trim(),
  }
}

export default function ProductOpportunityView({ products, kols, invitations, shipments, collaborationsByKol, productOptions, onProductsChange, onSelectKol }: Props) {
  const [selectedProduct, setSelectedProduct] = useState('')
  const [query, setQuery] = useState('')
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

  const selected = summary.find(item => item.product === selectedProduct) || summary[0]
  const q = query.trim().toLowerCase()
  const filteredRows = selected?.rows.filter(row => {
    if (!q) return true
    return [
      row.kol.name,
      row.kol.country,
      row.kol.platform,
      row.kol.followers,
      ...(row.kol.tags || []),
    ].some(value => String(value || '').toLowerCase().includes(q))
  }) || []

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
            {statusOrder.map(status => {
              const count = selected.counts[status]
              return (
                <div key={status} className="flex items-center gap-2 rounded-full bg-[#F5F5F7] px-3 py-1.5">
                  <span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />
                  <span className="text-[11px] font-bold text-[#6E6E73]">{status}</span>
                  <span className="text-xs font-extrabold tabular-nums text-[#1D1D1F]">{count}</span>
                </div>
              )
            })}
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

              return (
                <section key={status}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${statusDot[status]}`} />
                    <h3 className="text-sm font-extrabold text-[#1D1D1F]">{status}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone[status]}`}>{rows.length}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {rows.map(row => (
                      <button
                        key={`${selected.product}-${row.kol.id}-${status}`}
                        onClick={() => onSelectKol(row.kol)}
                        className={`rounded-[14px] border border-black/[0.06] bg-white p-4 text-left shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:border-[#0066FF]/30 hover:shadow-md ${status === '已拒绝' || status === '不推进' ? 'opacity-65' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-xs font-extrabold text-white">
                            {row.kol.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-extrabold text-[#1D1D1F]">{row.kol.name}</div>
                            <div className="mt-0.5 truncate text-[11px] font-semibold text-[#86868B]">{row.kol.platform} · {fmtFollowers(row.kol.followers)} · {row.kol.country || '-'}</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {(row.kol.tags || []).slice(0, 3).map(tag => (
                            <span key={tag} className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[11px] font-bold text-[#6E6E73]">{tag}</span>
                          ))}
                          {(row.kol.tags || []).length === 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[11px] font-bold text-[#AEAEB2]">
                              <UserRound className="h-3 w-3" /> 未分类
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
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
            onProductsChange={onProductsChange}
            onSelectProduct={setSelectedProduct}
          />
        </div>
      </div>
    </div>
  )
}

function ProductLibraryPanel({
  products,
  onProductsChange,
  onSelectProduct,
}: {
  products: Product[]
  onProductsChange: () => Promise<void> | void
  onSelectProduct: (productName: string) => void
}) {
  const [form, setForm] = useState<ProductFormState>(emptyProductForm)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const resetForm = () => {
    setEditingProduct(null)
    setForm(emptyProductForm)
    setMessage('')
  }

  const startEdit = (product: Product) => {
    setEditingProduct(product)
    setForm(formFromProduct(product))
    setMessage('')
  }

  const toggleShape = (shape: string) => {
    setForm(current => {
      const exists = current.target_content_shapes.includes(shape)
      const nextShapes = exists
        ? current.target_content_shapes.filter(item => item !== shape)
        : [...current.target_content_shapes, shape]

      return {
        ...current,
        target_content_shapes: nextShapes.length > 0 ? nextShapes : [shape],
      }
    })
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

  const archiveProduct = async (product: Product) => {
    if (product.status === '归档') return
    if (!confirm(`归档产品「${product.name}」？`)) return

    setSaving(true)
    setMessage('')
    try {
      await updateProduct(product.id, { status: '归档' })
      await onProductsChange()
      if (editingProduct?.id === product.id) resetForm()
      setMessage('产品已归档')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '归档失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
        <div>
          <div className="text-sm font-extrabold text-[#1D1D1F]">产品库</div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#86868B]">{products.length} 个产品</div>
        </div>
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

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="space-y-3 border-b border-black/[0.06] px-5 py-4 xl:min-h-0 xl:overflow-y-auto xl:border-b-0 xl:border-r">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2">
            <span className="mb-1 block text-[11px] font-bold text-[#86868B]">产品名称</span>
            <input
              value={form.name}
              onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
              className="h-9 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-bold text-[#86868B]">分类</span>
            <input
              value={form.category}
              onChange={event => setForm(current => ({ ...current, category: event.target.value }))}
              className="h-9 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
            />
          </label>
          <label>
            <span className="mb-1 block text-[11px] font-bold text-[#86868B]">优先级</span>
            <input
              type="number"
              value={form.priority}
              onChange={event => setForm(current => ({ ...current, priority: event.target.value }))}
              className="h-9 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
            />
          </label>
          <label className="col-span-2">
            <span className="mb-1 block text-[11px] font-bold text-[#86868B]">目标 KOL 标签</span>
            <input
              value={form.target_kol_tags}
              onChange={event => setForm(current => ({ ...current, target_kol_tags: event.target.value }))}
              placeholder="SBC, AI, 户外装备"
              className="h-9 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
            />
          </label>
          <div className="col-span-2">
            <span className="mb-1 block text-[11px] font-bold text-[#86868B]">内容形态</span>
            <div className="flex gap-2">
              {CONTENT_SHAPES.map(shape => {
                const selected = form.target_content_shapes.includes(shape)
                return (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => toggleShape(shape)}
                    className={`inline-flex h-8 flex-1 items-center justify-center rounded-[9px] text-[11px] font-extrabold transition ${selected ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#6E6E73] hover:bg-gray-200'}`}
                  >
                    {selected && <Check className="mr-1 h-3.5 w-3.5" />}
                    {shape}
                  </button>
                )
              })}
            </div>
          </div>
          <label>
            <span className="mb-1 block text-[11px] font-bold text-[#86868B]">状态</span>
            <select
              value={form.status}
              onChange={event => setForm(current => ({ ...current, status: event.target.value }))}
              className="h-9 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs font-semibold outline-none transition focus:border-[#0066FF]/40 focus:bg-white"
            >
              {PRODUCT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="col-span-2">
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
        {products.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-black/[0.08] bg-[#F5F5F7] px-4 py-6 text-center">
            <Package className="mx-auto mb-2 h-5 w-5 text-[#AEAEB2]" />
            <div className="text-xs font-extrabold text-[#1D1D1F]">暂无产品</div>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map(product => {
              const archived = product.status === '归档'
              const paused = product.status === '暂停'
              const tone = archived
                ? 'bg-slate-100 text-slate-500'
                : paused
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'

              return (
                <div key={product.id} className={`rounded-[12px] border border-black/[0.06] bg-white p-3 ${archived ? 'opacity-65' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => onSelectProduct(product.name)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-xs font-extrabold text-[#1D1D1F]" title={product.name}>{product.name}</div>
                      <div className="mt-1 truncate text-[11px] font-semibold text-[#86868B]">{product.category || '-'} · P{product.priority || 0}</div>
                    </button>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${tone}`}>{product.status}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {(product.target_kol_tags || []).slice(0, 4).map(tag => (
                      <span key={tag} className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[10px] font-bold text-[#6E6E73]">{tag}</span>
                    ))}
                    {(product.target_content_shapes || []).map(shape => (
                      <span key={shape} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{shape}</span>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(product)}
                      className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-[#F5F5F7] text-[11px] font-bold text-[#1D1D1F] transition hover:bg-gray-200"
                    >
                      <Pencil className="h-3.5 w-3.5" /> 编辑
                    </button>
                    {!archived && (
                      <button
                        type="button"
                        onClick={() => archiveProduct(product)}
                        className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-slate-100 text-[11px] font-bold text-slate-600 transition hover:bg-slate-200"
                      >
                        <Archive className="h-3.5 w-3.5" /> 归档
                      </button>
                    )}
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
