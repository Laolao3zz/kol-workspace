import { useState } from 'react'
import type { Collaboration, Shipment } from '../types'

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

export default function ArchiveCollaborationModal({ shipment, existing, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ArchiveFormData>({
    publish_date: existing?.publish_date || shipment.completed_at || new Date().toISOString().slice(0, 10),
    work_url: existing?.work_url || '',
    views: existing?.views ?? null,
    comments: existing?.comments ?? null,
    likes: existing?.likes ?? null,
    fee: existing?.fee || '',
    notes: existing?.notes || shipment.progress_notes || '',
  })

  const handleSubmit = () => {
    onSubmit({
      publish_date: form.publish_date || null,
      work_url: form.work_url.trim(),
      views: form.views,
      comments: form.comments,
      likes: form.likes,
      fee: form.fee.trim(),
      notes: form.notes.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[720px] max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">正式归档合作</h3>
            <p className="text-xs text-gray-400 mt-1">{shipment.product} · 补充效果数据后归入合作历史</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">发布日期</label>
              <input
                type="date"
                value={form.publish_date || ''}
                onChange={e => setForm(prev => ({ ...prev, publish_date: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">合作费用 / 条款</label>
              <input
                type="text"
                value={form.fee}
                onChange={e => setForm(prev => ({ ...prev, fee: e.target.value }))}
                placeholder="例如 ¥3000 / 佣金15% / 免费送样"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">播放量</label>
              <input
                type="number"
                min="0"
                value={parseNumber(form.views)}
                onChange={e => setForm(prev => ({ ...prev, views: toNullableNumber(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">评论数</label>
              <input
                type="number"
                min="0"
                value={parseNumber(form.comments)}
                onChange={e => setForm(prev => ({ ...prev, comments: toNullableNumber(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">点赞数</label>
              <input
                type="number"
                min="0"
                value={parseNumber(form.likes)}
                onChange={e => setForm(prev => ({ ...prev, likes: toNullableNumber(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400"
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400 resize-y"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
          <button onClick={handleSubmit} className="px-5 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors font-medium">正式归档</button>
        </div>
      </div>
    </div>
  )
}
