import { BarChart3, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Collaboration } from '../types'
import type { ContentShape } from '../utils/contentShape'
import { getContentShapeMetricLabels } from '../utils/contentShape'

interface Props {
  kolId: string
  collaboration?: Collaboration | null
  productOptions?: string[]
  contentShape?: ContentShape
  onClose: () => void
  onSubmit: (data: CollaborationFormData) => void
}

export interface CollaborationFormData {
  kol_id: string
  product: string
  publish_date: string
  work_url: string
  views: number
  comments: number
  likes: number
  fee: string
  notes: string
}

export default function AddCollaborationModal({ kolId, collaboration, productOptions = [], contentShape = '视频', onClose, onSubmit }: Props) {
  const isEditing = Boolean(collaboration)
  const metricLabels = getContentShapeMetricLabels(contentShape)
  const [form, setForm] = useState<CollaborationFormData>({
    kol_id: kolId,
    product: collaboration?.product || productOptions[0] || '',
    publish_date: collaboration?.publish_date || '',
    work_url: collaboration?.work_url || '',
    views: collaboration?.views || 0,
    comments: collaboration?.comments || 0,
    likes: collaboration?.likes || 0,
    fee: collaboration?.fee || '',
    notes: collaboration?.notes || '',
  })

  useEffect(() => {
    if (!collaboration && !form.product && productOptions[0]) {
      setForm(current => ({ ...current, product: productOptions[0] }))
    }
  }, [collaboration, form.product, productOptions])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product.trim() || !form.publish_date.trim()) return
    onSubmit({ ...form, product: form.product.trim(), publish_date: form.publish_date.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#1D1D1F] text-white">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#1D1D1F]">{isEditing ? '编辑合作记录' : '添加合作记录'}</h2>
              <p className="mt-1 text-xs font-medium text-[#86868B]">补齐发布内容与效果数据。</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-black/[0.08] text-[#86868B] hover:bg-[#F5F5F7]" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">产品名</label>
              <select
                value={form.product}
                onChange={e => setForm(p => ({ ...p, product: e.target.value }))}
                disabled={productOptions.length === 0}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              >
                {productOptions.length === 0 && <option value="">请先在产品库新增产品</option>}
                {productOptions.map(product => <option key={product} value={product}>{product}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">发布日期</label>
              <input
                type="date"
                value={form.publish_date}
                onChange={e => setForm(p => ({ ...p, publish_date: e.target.value }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">作品链接</label>
            <input
              type="url"
              value={form.work_url}
              onChange={e => setForm(p => ({ ...p, work_url: e.target.value }))}
              className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{metricLabels.viewsInput}</label>
              <input
                type="number"
                value={form.views || ''}
                onChange={e => setForm(p => ({ ...p, views: Number(e.target.value) }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{metricLabels.commentsInput}</label>
              <input
                type="number"
                value={form.comments || ''}
                onChange={e => setForm(p => ({ ...p, comments: Number(e.target.value) }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{metricLabels.likesInput}</label>
              <input
                type="number"
                value={form.likes || ''}
                onChange={e => setForm(p => ({ ...p, likes: Number(e.target.value) }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full resize-none rounded-[10px] border border-black/[0.08] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-4">
            <button type="button" onClick={onClose} className="h-10 rounded-[10px] px-4 text-sm font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">取消</button>
            <button type="submit" className="h-10 rounded-[10px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.35)]">{isEditing ? '保存修改' : '确认添加'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
