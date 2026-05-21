import { useState } from 'react'
import type { Shipment } from '../types'
import { PROGRESS_STATUSES } from '../types'

export interface ProgressFormData {
  progress_status: string
  progress_notes: string
  completed_at: string | null
}

interface Props {
  shipment: Shipment
  onClose: () => void
  onSubmit: (data: ProgressFormData) => void
}

export default function EditProgressModal({ shipment, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ProgressFormData>({
    progress_status: shipment.progress_status || '待制作',
    progress_notes: shipment.progress_notes || '',
    completed_at: shipment.completed_at || null,
  })

  const submit = () => {
    onSubmit({
      progress_status: form.completed_at ? '已完成' : form.progress_status || '待制作',
      progress_notes: form.progress_notes.trim(),
      completed_at: form.completed_at || null,
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[520px] max-h-[86vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">编辑内容进度</h3>
            <p className="text-xs text-gray-400 mt-1">{shipment.product} · 只更新内容推进信息，不影响物流记录</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-clay-100 bg-clay-50/60 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">进度状态</label>
                <select
                  value={form.progress_status}
                  onChange={e => setForm(prev => ({ ...prev, progress_status: e.target.value, completed_at: e.target.value === '已完成' ? prev.completed_at : null }))}
                  className="w-full px-3 py-2 text-sm border border-canvas-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clay-300 bg-white"
                >
                  {PROGRESS_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">完成日期</label>
                <input
                  type="date"
                  value={form.completed_at || ''}
                  onChange={e => setForm(prev => ({ ...prev, completed_at: e.target.value || null, progress_status: e.target.value ? '已完成' : prev.progress_status }))}
                  className="w-full px-3 py-2 text-sm border border-canvas-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clay-300 bg-white"
                />
              </div>
              <div className="col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, completed_at: new Date().toISOString().slice(0, 10), progress_status: '已完成' }))}
                  className="w-full px-3 py-2 text-sm bg-sage-500 text-white rounded-lg hover:bg-sage-600 transition-colors"
                >
                  标记今天完成
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">进度备注</label>
            <textarea
              value={form.progress_notes}
              onChange={e => setForm(prev => ({ ...prev, progress_notes: e.target.value }))}
              rows={4}
              placeholder="例如：已签收待制作 / 已催发布日期 / 内容卡住原因"
              className="w-full px-3 py-2 text-sm border border-canvas-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-clay-300 resize-y"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-canvas-100 rounded-lg transition-colors">取消</button>
          <button
            onClick={submit}
            className="px-5 py-2 text-sm bg-clay-400 text-white rounded-lg hover:bg-clay-500 shadow-soft transition-all font-medium"
          >
            保存进度
          </button>
        </div>
      </div>
    </div>
  )
}
