import { CheckCircle2, ListChecks, X } from 'lucide-react'
import { useState } from 'react'
import type { Shipment } from '../types'
import { PROGRESS_STATUSES } from '../types'
import { buildProgressSubmitPayload } from '../utils/progressPayload'

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
    onSubmit(buildProgressSubmitPayload(form))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[calc(100dvh-24px)] w-[520px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[12px] border border-black/[0.06] bg-white p-4 shadow-2xl sm:max-h-[86vh] sm:max-w-[calc(100vw-32px)] sm:rounded-[20px] sm:p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#1D1D1F] text-white">
              <ListChecks className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#1D1D1F]">编辑内容进度</h3>
              <p className="mt-1 text-xs font-medium text-[#86868B]">{shipment.product} · 只更新内容推进信息，不影响物流记录</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-black/[0.08] text-[#86868B] hover:bg-[#F5F5F7]" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-[16px] border border-black/[0.06] bg-[#F5F5F7] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">进度状态</label>
                <select
                  value={form.progress_status}
                  onChange={e => setForm(prev => ({ ...prev, progress_status: e.target.value, completed_at: e.target.value === '已完成' ? prev.completed_at : null }))}
                  className="h-10 w-full rounded-[10px] border border-black/[0.08] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
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
                  className="h-10 w-full rounded-[10px] border border-black/[0.08] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
                />
              </div>
              <div className="col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, completed_at: new Date().toISOString().slice(0, 10), progress_status: '已完成' }))}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-emerald-600 px-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
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
              className="w-full resize-y rounded-[10px] border border-black/[0.08] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-black/[0.06] pt-4">
          <button onClick={onClose} className="h-10 rounded-[10px] px-4 text-sm font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">取消</button>
          <button
            onClick={submit}
            className="h-10 rounded-[10px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.35)]"
          >
            保存进度
          </button>
        </div>
      </div>
    </div>
  )
}
