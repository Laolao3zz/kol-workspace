import { useState } from 'react'
import { Invitation, REPLY_RESULTS } from '../types'

interface Props {
  kolId: string
  invitation?: Invitation | null
  onClose: () => void
  onSubmit: (data: InvitationFormData) => void
}

export interface InvitationFormData {
  kol_id: string
  product: string
  invited_at: string
  email_subject: string
  replied: boolean
  reply_result: string
  notes: string
}

export default function AddInvitationModal({ kolId, invitation, onClose, onSubmit }: Props) {
  const isEditing = Boolean(invitation)
  const [form, setForm] = useState<InvitationFormData>({
    kol_id: kolId,
    product: invitation?.product || '',
    invited_at: invitation?.invited_at || new Date().toISOString().slice(0, 10),
    email_subject: invitation?.email_subject || '',
    replied: invitation?.replied || false,
    reply_result: invitation?.reply_result || '',
    notes: invitation?.notes || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product.trim()) return
    onSubmit({ ...form, product: form.product.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <span className="text-2xl">📩</span> {isEditing ? '编辑邀约记录' : '添加邀约记录'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">产品</label>
              <input
                type="text"
                value={form.product}
                onChange={e => setForm(p => ({ ...p, product: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="手动输入产品名称"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">邀约日期</label>
              <input
                type="date"
                value={form.invited_at}
                onChange={e => setForm(p => ({ ...p, invited_at: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.replied}
                onChange={e => setForm(p => ({ ...p, replied: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
              />
              <span className="text-sm text-gray-700">已回复</span>
            </label>
          </div>

          {form.replied && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">回复结果</label>
              <select
                value={form.reply_result}
                onChange={e => setForm(p => ({ ...p, reply_result: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">-- 选择 --</option>
                {REPLY_RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button type="submit" className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">{isEditing ? '保存修改' : '确认添加'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
