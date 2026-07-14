import { AlertTriangle, CheckCircle2, Copy, MailPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Collaboration, Invitation, KOL, Shipment } from '../types'
import { createInvitation } from '../services/invitationService'
import { updateKOL } from '../services/kolService'
import { buildBatchOutreachSelection } from '../utils/batchOutreach'
import { deriveKolStatus } from '../utils/kolStatus'

interface Props {
  kols: KOL[]
  product: string
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
  onClose: () => void
  onComplete: (failedKolIds: string[]) => void
  onDataChange: () => Promise<void> | void
}

export default function ProductBatchInviteModal({
  kols,
  product,
  invitations,
  shipments,
  collaborationsByKol,
  onClose,
  onComplete,
  onDataChange,
}: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState('')
  const [completed, setCompleted] = useState(false)
  const outreach = useMemo(() => buildBatchOutreachSelection(kols), [kols])

  const copyRecipients = async () => {
    if (!outreach.recipientText) return
    try {
      await navigator.clipboard.writeText(outreach.recipientText)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const closeModal = () => {
    if (completed) onComplete([])
    onClose()
  }

  const recordInvitations = async () => {
    if (saving || outreach.validKols.length === 0) return
    setSaving(true)
    setResult('')
    try {
      const settled = await Promise.allSettled(outreach.validKols.map(async kol => {
        const invitation = await createInvitation({
          kol_id: kol.id,
          product,
          invited_at: new Date().toISOString().slice(0, 10),
          email_subject: '',
          replied: false,
          reply_result: '未回复',
          notes: '',
          quoted_fee: '',
          decision: '待评估',
          decision_reason: '',
        })

        const nextInvitations = [invitation, ...(invitations[kol.id] || [])]
        const nextStatus = deriveKolStatus(
          kol,
          nextInvitations,
          shipments.filter(shipment => shipment.kol_id === kol.id),
          collaborationsByKol[kol.id] || []
        )
        if (nextStatus !== kol.status) {
          await updateKOL(kol.id, { status: nextStatus }).catch(() => undefined)
        }
      }))

      const failedKolIds = settled.flatMap((item, index) =>
        item.status === 'rejected' ? [outreach.validKols[index].id] : []
      )
      const succeeded = settled.length - failedKolIds.length
      setResult(failedKolIds.length > 0
        ? `已记录 ${succeeded} 位，${failedKolIds.length} 位失败。`
        : `已为 ${succeeded} 位 KOL 记录 ${product} 邀约。`)
      if (failedKolIds.length > 0) onComplete(failedKolIds)
      else setCompleted(true)
      await Promise.resolve(onDataChange())
    } catch (error) {
      setResult(error instanceof Error ? error.message : '数据刷新失败，请重新加载后核对')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={saving ? undefined : closeModal} />
      <div className="relative w-[560px] max-w-[calc(100vw-32px)] rounded-[18px] border border-black/[0.06] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-blue-50 text-[#0066FF]"><MailPlus className="h-4 w-4" /></span>
            <div>
              <h3 className="text-base font-extrabold text-[#1D1D1F]">批量邀约 · {product}</h3>
              <p className="mt-1 text-xs font-medium text-[#86868B]">已选择 {kols.length} 位 KOL</p>
            </div>
          </div>
          <button type="button" onClick={closeModal} disabled={saving} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#F5F5F7] text-[#86868B] disabled:opacity-50" title="关闭"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-[#6E6E73]">
            <span>邮箱收件人</span>
            <span>{outreach.recipients.length} 个邮箱</span>
          </div>
          <div className="flex items-stretch gap-2">
            <textarea readOnly value={outreach.recipientText} rows={4} className="min-w-0 flex-1 resize-none rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 py-2 text-xs font-semibold leading-5 outline-none" placeholder="所选 KOL 暂无有效邮箱" />
            <button type="button" onClick={copyRecipients} disabled={!outreach.recipientText} className="inline-flex w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-[#1D1D1F] text-[11px] font-bold text-white disabled:opacity-35">
              {copyState === 'copied' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copyState === 'copied' ? '已复制' : '复制收件人'}
            </button>
          </div>
          {copyState === 'failed' && <p className="mt-1.5 text-[11px] font-semibold text-red-600">自动复制失败，请手动复制文本框内容。</p>}
          {outreach.missingEmailKols.length > 0 && (
            <div className="mt-2 flex items-start gap-2 rounded-[10px] border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{outreach.missingEmailKols.length} 位缺少有效邮箱，不会记录邀约：{outreach.missingEmailKols.map(kol => kol.name).join('、')}</span>
            </div>
          )}
        </div>

        {result && <div className={`mt-4 rounded-[10px] px-3 py-2 text-xs font-bold ${result.includes('失败') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{result}</div>}

        <div className="mt-5 flex justify-end gap-2 border-t border-black/[0.06] pt-4">
          <button type="button" onClick={closeModal} disabled={saving} className="h-9 rounded-[9px] px-4 text-xs font-bold text-[#6E6E73] hover:bg-[#F5F5F7] disabled:opacity-50">关闭</button>
          <button type="button" onClick={recordInvitations} disabled={saving || outreach.validKols.length === 0 || Boolean(result)} className="h-9 rounded-[9px] bg-[#0066FF] px-4 text-xs font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.3)] disabled:cursor-not-allowed disabled:opacity-40">
            {saving ? '正在记录...' : '邮件已发送，记录邀约'}
          </button>
        </div>
      </div>
    </div>
  )
}
