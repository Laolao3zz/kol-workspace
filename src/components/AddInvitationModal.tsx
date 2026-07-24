import { ArrowDownLeft, ArrowUpRight, Check, Handshake, X } from 'lucide-react'
import { useState } from 'react'
import type { Invitation, InvitationDirection } from '../types'
import { createConversationId, getInvitationDirection } from '../utils/opportunityConversation'

interface Props {
  kolId: string
  invitation?: Invitation | null
  productOptions?: string[]
  canChangeProduct?: boolean
  onClose: () => void
  onSubmit: (data: InvitationFormData) => void
}

export interface InvitationFormData {
  kol_id: string
  conversation_id: string
  direction: InvitationDirection
  products: string[]
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

const getInitialOutcome = (invitation?: Invitation | null): CooperationOutcome => {
  if (!invitation || !invitation.replied || invitation.reply_result === '未回复' || invitation.reply_result === '沟通中') return 'pending'
  if (invitation.decision === '我方拒绝') return 'company_declined'
  if (invitation.reply_result?.includes('拒绝')) return 'creator_declined'
  if (invitation.reply_result?.includes('同意')) return 'agreed'
  return 'pending'
}

const outcomeOptions = (direction: InvitationDirection): Array<{ value: CooperationOutcome; label: string; desc: string; tone: string }> => [
  direction === 'inbound'
    ? { value: 'pending', label: '待评估 / 沟通中', desc: '博主已主动联系，等待我方评估或继续沟通', tone: 'border-cyan-200 bg-cyan-50 text-cyan-700' }
    : { value: 'pending', label: '等待回复', desc: '我方已发出邀约，14 天内列入待回复', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  { value: 'agreed', label: '同意合作', desc: '每个所选产品分别生成待寄出记录', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { value: 'creator_declined', label: direction === 'inbound' ? '博主撤回 / 不推进' : '博主不同意', desc: '仅记录当前产品结果，不影响以后合作', tone: 'border-red-200 bg-red-50 text-red-700' },
  { value: 'company_declined', label: '我方不推进（不寄送）', desc: '保留沟通历史，并清理尚未开始的自动待寄出记录', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
]

const applyOutcome = (form: InvitationFormData, outcome: CooperationOutcome): InvitationFormData => {
  const pending = form.direction === 'inbound'
    ? { replied: true, reply_result: '沟通中', decision: '待评估', decision_reason: '' }
    : { replied: false, reply_result: '未回复', decision: '待评估', decision_reason: '' }
  const outcomePayload: Record<CooperationOutcome, Pick<InvitationFormData, 'replied' | 'reply_result' | 'decision' | 'decision_reason'>> = {
    pending,
    agreed: { replied: true, reply_result: '同意合作', decision: '继续推进', decision_reason: '' },
    creator_declined: { replied: true, reply_result: '拒绝合作', decision: '待评估', decision_reason: form.direction === 'inbound' ? '博主撤回' : '博主不同意' },
    company_declined: { replied: true, reply_result: '同意合作', decision: '我方拒绝', decision_reason: '我方不同意' },
  }

  return { ...form, ...outcomePayload[outcome] }
}

export default function AddInvitationModal({ kolId, invitation, productOptions = [], canChangeProduct = false, onClose, onSubmit }: Props) {
  const isEditing = Boolean(invitation)
  const initialDirection = invitation ? getInvitationDirection(invitation) : 'outbound'
  const initialOutcome = getInitialOutcome(invitation)
  const [outcome, setOutcome] = useState<CooperationOutcome>(initialOutcome)
  const [form, setForm] = useState<InvitationFormData>(() => applyOutcome({
    kol_id: kolId,
    conversation_id: invitation?.conversation_id || createConversationId(),
    direction: initialDirection,
    products: invitation?.product ? [invitation.product] : [],
    invited_at: invitation?.invited_at || new Date().toISOString().slice(0, 10),
    email_subject: invitation?.email_subject || '',
    replied: invitation?.replied || false,
    reply_result: invitation?.reply_result || '未回复',
    quoted_fee: invitation?.quoted_fee || '',
    decision: invitation?.decision || '待评估',
    decision_reason: invitation?.decision_reason || '',
    notes: invitation?.notes || '',
  }, initialOutcome))

  const updateDirection = (direction: InvitationDirection) => {
    if (isEditing) return
    setForm(previous => applyOutcome({ ...previous, direction }, outcome))
  }

  const updateOutcome = (nextOutcome: CooperationOutcome) => {
    setOutcome(nextOutcome)
    setForm(previous => applyOutcome(previous, nextOutcome))
  }

  const toggleProduct = (product: string) => {
    if (isEditing) {
      if (canChangeProduct) setForm(previous => ({ ...previous, products: [product] }))
      return
    }
    setForm(previous => ({
      ...previous,
      products: previous.products.includes(product)
        ? previous.products.filter(item => item !== product)
        : [...previous.products, product],
    }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (form.products.length === 0) return
    const normalized = applyOutcome(form, outcome)
    onSubmit({
      ...normalized,
      products: normalized.products.map(product => product.trim()).filter(Boolean),
      email_subject: normalized.email_subject.trim(),
      quoted_fee: normalized.quoted_fee.trim(),
      notes: normalized.notes.trim(),
    })
  }

  const options = outcomeOptions(form.direction)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative mx-3 max-h-[calc(100dvh-24px)] w-full max-w-3xl overflow-y-auto rounded-[12px] border border-black/[0.07] bg-white p-4 shadow-2xl sm:mx-4 sm:max-h-[92vh] sm:rounded-[16px] sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#1D1D1F] text-white">
              <Handshake className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#1D1D1F]">{isEditing ? '更新产品进展' : '记录沟通'}</h2>
              <p className="mt-1 text-xs font-medium text-[#86868B]">{isEditing ? `当前只处理 ${invitation?.product || '这个产品'}，不会影响同次沟通中的其他产品。` : '一次沟通可包含多个产品，后续按产品分别推进。'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-black/[0.08] text-[#86868B] hover:bg-[#F5F5F7]" title="关闭"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold text-[#525257]">机会来源</label>
            <div className="grid grid-cols-2 gap-2 rounded-[10px] bg-[#F1F2F4] p-1">
              <DirectionButton active={form.direction === 'outbound'} disabled={isEditing} onClick={() => updateDirection('outbound')} icon={<ArrowUpRight className="h-4 w-4" />} label="我方主动邀约" description="发出邮件后等待博主回复" />
              <DirectionButton active={form.direction === 'inbound'} disabled={isEditing} onClick={() => updateDirection('inbound')} icon={<ArrowDownLeft className="h-4 w-4" />} label="博主主动联系" description="博主先提出测评或合作" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold text-[#525257]">合作产品 <span className="text-red-500">*</span></label>
              {!isEditing && <span className="text-[11px] font-semibold text-[#86868B]">已选择 {form.products.length} 个</span>}
            </div>
            {isEditing ? (
              <div>
                <select
                  value={form.products[0] || ''}
                  onChange={event => toggleProduct(event.target.value)}
                  disabled={!canChangeProduct}
                  className="h-11 w-full rounded-[8px] border border-black/[0.08] bg-white px-3 text-sm font-bold text-[#1D1D1F] outline-none focus:border-[#0066FF]/40 disabled:cursor-not-allowed disabled:bg-[#F5F5F7] disabled:text-[#6E6E73]"
                >
                  {productOptions.map(product => <option key={product} value={product}>{product}</option>)}
                </select>
                <div className={`mt-2 rounded-[8px] border px-3 py-2 text-[11px] font-semibold leading-5 ${canChangeProduct ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
                  {canChangeProduct
                    ? '如果只是产品录错，可以在这里更换。若该产品后续不寄送，请保留产品并在下方选择“我方不推进（不寄送）”。'
                    : '该产品已经生成关联发货，名称已锁定。若后续不再寄送，请在下方选择“我方不推进（不寄送）”；已开始的物流记录不会被自动删除。'}
                </div>
              </div>
            ) : productOptions.length === 0 ? (
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-700">请先在产品库新增产品</div>
            ) : (
              <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-[10px] border border-black/[0.07] bg-[#FAFBFC] p-2 sm:grid-cols-3">
                {productOptions.map(product => {
                  const selected = form.products.includes(product)
                  return (
                    <button key={product} type="button" onClick={() => toggleProduct(product)} className={`flex min-h-10 items-center gap-2 rounded-[8px] border px-3 py-2 text-left text-xs font-bold transition ${selected ? 'border-[#0066FF]/30 bg-blue-50 text-[#005FE8]' : 'border-transparent bg-white text-[#525257] hover:border-black/[0.08]'}`}>
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${selected ? 'border-[#0066FF] bg-[#0066FF] text-white' : 'border-black/15 bg-white'}`}>{selected && <Check className="h-3 w-3" />}</span>
                      <span className="truncate" title={product}>{product}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">联系日期</label>
              <input type="date" value={form.invited_at} onChange={event => setForm(previous => ({ ...previous, invited_at: event.target.value }))} className="h-10 w-full rounded-[8px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">邮件主题 / 联系来源</label>
              <input value={form.email_subject} onChange={event => setForm(previous => ({ ...previous, email_subject: event.target.value }))} className="h-10 w-full rounded-[8px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40" placeholder={form.direction === 'inbound' ? '例如官网表单 / 邮件主题' : '例如 K1 Review Opportunity'} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold text-[#525257]">当前结果</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {options.map(option => {
                const active = outcome === option.value
                return (
                  <button key={option.value} type="button" onClick={() => updateOutcome(option.value)} className={`rounded-[10px] border p-3 text-left transition ${active ? `${option.tone} shadow-sm ring-2 ring-black/[0.03]` : 'border-black/[0.08] bg-white text-gray-600 hover:bg-[#F5F5F7]'}`}>
                    <div className="text-sm font-semibold">{option.label}</div>
                    <div className="mt-1 text-[11px] leading-relaxed opacity-80">{option.desc}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">KOL 报价 / 合作条款</label>
            <input value={form.quoted_fee} onChange={event => setForm(previous => ({ ...previous, quoted_fee: event.target.value }))} className="h-10 w-full rounded-[8px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40" placeholder={form.products.length > 1 ? '例如 两个产品组合报价 $1,500' : '例如 $1,500 / 送样免费 / 佣金合作'} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">备注</label>
            <textarea value={form.notes} onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))} rows={3} placeholder="记录关键沟通信息即可。" className="w-full resize-none rounded-[8px] border border-black/[0.08] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0066FF]/40" />
          </div>

          <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-4">
            <button type="button" onClick={onClose} className="h-10 rounded-[8px] px-4 text-sm font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">取消</button>
            <button type="submit" disabled={form.products.length === 0} className="h-10 rounded-[8px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.3)] disabled:cursor-not-allowed disabled:opacity-40">{isEditing ? '保存产品进展' : `记录 ${form.products.length || ''} 个产品`}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DirectionButton({ active, disabled, onClick, icon, label, description }: { active: boolean; disabled: boolean; onClick: () => void; icon: React.ReactNode; label: string; description: string }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-left transition ${active ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#86868B] hover:text-[#525257]'} disabled:cursor-default`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] ${active ? 'bg-[#1D1D1F] text-white' : 'bg-white text-[#86868B]'}`}>{icon}</span>
      <span><span className="block text-xs font-extrabold">{label}</span><span className="mt-0.5 block text-[10px] font-medium opacity-70">{description}</span></span>
    </button>
  )
}
