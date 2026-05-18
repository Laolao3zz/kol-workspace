import { useState } from 'react'
import { Invitation } from '../types'

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
  quoted_fee: string
  decision: string
  decision_reason: string
  notes: string
}

type CooperationOutcome = 'pending' | 'agreed' | 'creator_declined' | 'company_declined'

const OUTCOME_OPTIONS: Array<{ value: CooperationOutcome; label: string; desc: string; tone: string }> = [
  { value: 'pending', label: '未回复 / 待确认', desc: '只记录已发起邀约，KOL 状态进入已邀约', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  { value: 'agreed', label: '同意合作', desc: '会自动进入待寄出，并生成一条待寄出寄样记录', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { value: 'creator_declined', label: '博主不同意', desc: 'KOL 状态进入拒绝合作', tone: 'border-red-200 bg-red-50 text-red-700' },
  { value: 'company_declined', label: '我方不同意', desc: 'KOL 状态进入我方拒绝', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
]

const getInitialOutcome = (invitation?: Invitation | null): CooperationOutcome => {
  if (!invitation || !invitation.replied || invitation.reply_result === '未回复') return 'pending'
  if (invitation.decision === '我方拒绝') return 'company_declined'
  if (invitation.reply_result?.includes('拒绝')) return 'creator_declined'
  if (invitation.reply_result?.includes('同意')) return 'agreed'
  return 'pending'
}

const applyOutcome = (form: InvitationFormData, outcome: CooperationOutcome): InvitationFormData => {
  const outcomePayload: Record<CooperationOutcome, Pick<InvitationFormData, 'replied' | 'reply_result' | 'decision' | 'decision_reason'>> = {
    pending: { replied: false, reply_result: '未回复', decision: '待评估', decision_reason: '' },
    agreed: { replied: true, reply_result: '同意合作', decision: '继续推进', decision_reason: '' },
    creator_declined: { replied: true, reply_result: '拒绝合作', decision: '待评估', decision_reason: '博主不同意' },
    company_declined: { replied: true, reply_result: '同意合作', decision: '我方拒绝', decision_reason: '我方不同意' },
  }

  return { ...form, ...outcomePayload[outcome] }
}

export default function AddInvitationModal({ kolId, invitation, onClose, onSubmit }: Props) {
  const isEditing = Boolean(invitation)
  const initialOutcome = getInitialOutcome(invitation)
  const [outcome, setOutcome] = useState<CooperationOutcome>(initialOutcome)
  const [form, setForm] = useState<InvitationFormData>(() => applyOutcome({
    kol_id: kolId,
    product: invitation?.product || '',
    invited_at: invitation?.invited_at || new Date().toISOString().slice(0, 10),
    email_subject: invitation?.email_subject || '',
    replied: invitation?.replied || false,
    reply_result: invitation?.reply_result || '未回复',
    quoted_fee: invitation?.quoted_fee || '',
    decision: invitation?.decision || '待评估',
    decision_reason: invitation?.decision_reason || '',
    notes: invitation?.notes || '',
  }, initialOutcome))

  const updateOutcome = (nextOutcome: CooperationOutcome) => {
    setOutcome(nextOutcome)
    setForm(prev => applyOutcome(prev, nextOutcome))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product.trim()) return
    const normalized = applyOutcome(form, outcome)
    onSubmit({
      ...normalized,
      product: normalized.product.trim(),
      quoted_fee: normalized.quoted_fee.trim(),
      notes: normalized.notes.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <span className="text-2xl">📩</span> {isEditing ? '编辑邀约记录' : '添加邀约记录'}
        </h2>
        <p className="text-xs text-gray-400 mb-5">邀约只保留一次合作结果：同意、博主不同意、我方不同意，避免重复状态。</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">产品</label>
              <input
                type="text"
                value={form.product}
                onChange={e => setForm(p => ({ ...p, product: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="手动输入产品名称"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">邀约日期</label>
              <input
                type="date"
                value={form.invited_at}
                onChange={e => setForm(p => ({ ...p, invited_at: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">合作结果</label>
            <div className="grid grid-cols-2 gap-3">
              {OUTCOME_OPTIONS.map(option => {
                const active = outcome === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateOutcome(option.value)}
                    className={`text-left rounded-xl border p-3 transition-all ${active ? `${option.tone} shadow-sm ring-2 ring-purple-100` : 'border-gray-200 bg-white text-gray-600 hover:border-purple-200 hover:bg-purple-50/40'}`}
                  >
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className="text-[11px] mt-1 opacity-80 leading-relaxed">{option.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">KOL 报价 / 合作条款</label>
            <input
              type="text"
              value={form.quoted_fee}
              onChange={e => setForm(p => ({ ...p, quoted_fee: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="例如 $1,500 / 送样免费 / 佣金合作"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">备注</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={3}
              placeholder="记录关键沟通信息即可，不需要额外维护多套状态。"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button type="submit" className="px-5 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 shadow-sm">{isEditing ? '保存修改' : '确认添加'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
