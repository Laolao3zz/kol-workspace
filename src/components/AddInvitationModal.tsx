import { MailPlus, X } from 'lucide-react'
import { useId, useState } from 'react'
import { Invitation } from '../types'

interface Props {
  kolId: string
  invitation?: Invitation | null
  productOptions?: string[]
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
  { value: 'creator_declined', label: '博主不同意', desc: '仅记录本次产品结果，后续仍可邀约其他产品', tone: 'border-red-200 bg-red-50 text-red-700' },
  { value: 'company_declined', label: '我方不同意', desc: '仅记录本次产品不推进，不把 KOL 标成永久拒绝', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
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

export default function AddInvitationModal({ kolId, invitation, productOptions = [], onClose, onSubmit }: Props) {
  const isEditing = Boolean(invitation)
  const productListId = useId()
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
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-2xl rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#1D1D1F] text-white">
              <MailPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#1D1D1F]">{isEditing ? '编辑邀约记录' : '添加邀约记录'}</h2>
              <p className="mt-1 text-xs font-medium text-[#86868B]">记录本次产品邀约结果，保持产品级状态清晰。</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-black/[0.08] text-[#86868B] hover:bg-[#F5F5F7]" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">产品</label>
              <input
                type="text"
                value={form.product}
                onChange={e => setForm(p => ({ ...p, product: e.target.value }))}
                list={productOptions.length > 0 ? productListId : undefined}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
                placeholder="手动输入产品名称"
              />
              {productOptions.length > 0 && (
                <datalist id={productListId}>
                  {productOptions.map(product => <option key={product} value={product} />)}
                </datalist>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">邀约日期</label>
              <input
                type="date"
                value={form.invited_at}
                onChange={e => setForm(p => ({ ...p, invited_at: e.target.value }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
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
                    className={`rounded-[14px] border p-3 text-left transition-all ${active ? `${option.tone} shadow-sm ring-2 ring-black/[0.04]` : 'border-black/[0.08] bg-white text-gray-600 hover:bg-[#F5F5F7]'}`}
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
              className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
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
