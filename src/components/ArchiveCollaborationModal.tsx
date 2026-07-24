import { Archive, X } from 'lucide-react'
import { useState } from 'react'
import type { Collaboration, Shipment } from '../types'
import type { ContentShape } from '../utils/contentShape'
import { getContentShapeMetricLabels } from '../utils/contentShape'
import { stripShipmentHistoryMarkers } from '../utils/collaborationArchive'

export interface ArchiveFormData {
  publish_date: string | null
  work_url: string
  views: number | null
  comments: number | null
  likes: number | null
  fee: string
  notes: string
}

interface Props {
  shipment: Shipment
  existing?: Collaboration | null
  contentShape?: ContentShape
  onClose: () => void
  onSubmit: (data: ArchiveFormData) => void
}

const parseNumber = (value?: number | null) => value == null ? '' : String(value)
const toNullableNumber = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? numeric : null
}

export default function ArchiveCollaborationModal({ shipment, existing, contentShape = '视频', onClose, onSubmit }: Props) {
  const metricLabels = getContentShapeMetricLabels(contentShape)
  const [form, setForm] = useState<ArchiveFormData>({
    publish_date: existing?.publish_date || shipment.completed_at || new Date().toISOString().slice(0, 10),
    work_url: existing?.work_url || '',
    views: existing?.views ?? null,
    comments: existing?.comments ?? null,
    likes: existing?.likes ?? null,
    fee: existing?.fee || '',
    notes: stripShipmentHistoryMarkers(existing?.notes || shipment.progress_notes),
  })

  const handleSubmit = () => {
    onSubmit({
      publish_date: form.publish_date || null,
      work_url: form.work_url.trim(),
      views: form.views,
      comments: form.comments,
      likes: form.likes,
      fee: form.fee.trim(),
      notes: stripShipmentHistoryMarkers(form.notes),
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[calc(100dvh-24px)] w-[720px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[12px] border border-black/[0.06] bg-white p-4 shadow-2xl sm:max-h-[90vh] sm:max-w-[calc(100vw-32px)] sm:rounded-[20px] sm:p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#1D1D1F] text-white">
              <Archive className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#1D1D1F]">正式归档合作</h3>
              <p className="mt-1 text-xs font-medium text-[#86868B]">{shipment.product} · 补充效果数据后归入合作历史</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-black/[0.08] text-[#86868B] hover:bg-[#F5F5F7]" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">发布日期</label>
              <input
                type="date"
                value={form.publish_date || ''}
                onChange={e => setForm(prev => ({ ...prev, publish_date: e.target.value || null }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">合作费用 / 条款</label>
              <input
                type="text"
                value={form.fee}
                onChange={e => setForm(prev => ({ ...prev, fee: e.target.value }))}
                placeholder="例如 ¥3000 / 佣金15% / 免费送样"
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">作品链接</label>
            <input
              type="text"
              value={form.work_url}
              onChange={e => setForm(prev => ({ ...prev, work_url: e.target.value }))}
              placeholder="https://..."
              className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{metricLabels.viewsInput}</label>
              <input
                type="number"
                min="0"
                value={parseNumber(form.views)}
                onChange={e => setForm(prev => ({ ...prev, views: toNullableNumber(e.target.value) }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{metricLabels.commentsInput}</label>
              <input
                type="number"
                min="0"
                value={parseNumber(form.comments)}
                onChange={e => setForm(prev => ({ ...prev, comments: toNullableNumber(e.target.value) }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{metricLabels.likesInput}</label>
              <input
                type="number"
                min="0"
                value={parseNumber(form.likes)}
                onChange={e => setForm(prev => ({ ...prev, likes: toNullableNumber(e.target.value) }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">归档备注</label>
            <textarea
              rows={4}
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="补充合作表现、复盘结论、后续是否继续合作等"
              className="w-full resize-y rounded-[10px] border border-black/[0.08] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-black/[0.06] pt-4">
          <button onClick={onClose} className="h-10 rounded-[10px] px-4 text-sm font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">取消</button>
          <button onClick={handleSubmit} className="h-10 rounded-[10px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.35)]">正式归档</button>
        </div>
      </div>
    </div>
  )
}
