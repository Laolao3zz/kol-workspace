import { useState } from 'react'
import type { Collaboration } from '../types'

interface Props {
  kolId: string
  collaboration?: Collaboration | null
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

export default function AddCollaborationModal({ kolId, collaboration, onClose, onSubmit }: Props) {
  const isEditing = Boolean(collaboration)
  const [form, setForm] = useState<CollaborationFormData>({
    kol_id: kolId,
    product: collaboration?.product || '',
    publish_date: collaboration?.publish_date || '',
    work_url: collaboration?.work_url || '',
    views: collaboration?.views || 0,
    comments: collaboration?.comments || 0,
    likes: collaboration?.likes || 0,
    fee: collaboration?.fee || '',
    notes: collaboration?.notes || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product.trim() || !form.publish_date.trim()) return
    onSubmit({ ...form, product: form.product.trim(), publish_date: form.publish_date.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <span className="text-2xl">📊</span> {isEditing ? '编辑合作记录' : '添加合作记录'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">产品名</label>
              <input
                type="text"
                value={form.product}
                onChange={e => setForm(p => ({ ...p, product: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400/50"
                placeholder="手动输入产品名称"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">发布日期</label>
              <input
                type="date"
                value={form.publish_date}
                onChange={e => setForm(p => ({ ...p, publish_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">作品链接</label>
            <input
              type="url"
              value={form.work_url}
              onChange={e => setForm(p => ({ ...p, work_url: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400/50"
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">播放量</label>
              <input
                type="number"
                value={form.views || ''}
                onChange={e => setForm(p => ({ ...p, views: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">评论数</label>
              <input
                type="number"
                value={form.comments || ''}
                onChange={e => setForm(p => ({ ...p, comments: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">点赞数</label>
              <input
                type="number"
                value={form.likes || ''}
                onChange={e => setForm(p => ({ ...p, likes: Number(e.target.value) }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-400/50 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button type="submit" className="px-5 py-2 bg-sage-600 text-white text-sm rounded-lg hover:bg-sage-700 shadow-soft">{isEditing ? '保存修改' : '确认添加'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
