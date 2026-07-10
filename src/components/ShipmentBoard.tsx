import { AlertTriangle, Archive, CheckCircle2, Clock3, PackageCheck, Pencil, Send, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Collaboration, Invitation, KOL, PROGRESS_STATUSES, Shipment } from '../types'
import { createCollaboration, ensureCompletionCollaboration, getCollaborationsByKOL, updateCollaboration } from '../services/collaborationService'
import { updateShipment } from '../services/shipmentService'
import ArchiveCollaborationModal, { ArchiveFormData } from './ArchiveCollaborationModal'
import { findCollaborationForShipment, withShipmentHistoryMarker } from '../utils/collaborationArchive'
import { getKolContentShape } from '../utils/contentShape'
import { countActiveShipments } from '../utils/workspaceViews'

interface Props {
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  onSelect: (kol: KOL) => void
  onUpdate: (id: string, updates: Partial<KOL>) => Promise<KOL> | KOL
  onShipmentsChange: () => Promise<void> | void
  onCollaborationsChange: () => Promise<void> | void
}

type ProgressDraft = {
  progress_status: string
  progress_notes: string
}

type BoardColumn = {
  key: 'pending' | 'transit' | 'progress' | 'completed'
  label: string
  subtitle: string
  icon: LucideIcon
  dot: string
  tint: string
  shipments: Shipment[]
}

const todayISO = () => new Date().toISOString().slice(0, 10)

const daysSince = (date?: string | null) => {
  if (!date) return 0
  const start = new Date(`${date}T00:00:00`).getTime()
  const end = new Date(`${todayISO()}T00:00:00`).getTime()
  return Math.max(0, Math.floor((end - start) / 86400000))
}

const isShipmentCompleted = (shipment: Shipment) => shipment.progress_status === '已完成' || Boolean(shipment.completed_at)
const isShipmentArchived = (shipment: Shipment) => Boolean(shipment.archived_at)
const isShipmentVisible = (shipment: Shipment) => !isShipmentArchived(shipment)

const progressLabel = (shipment: Shipment) => {
  if (isShipmentCompleted(shipment)) return '合作完成'
  if (shipment.status === '已签收') return shipment.progress_status || '待制作'
  return shipment.status
}

const kolMainStatus = (shipment: Shipment) => {
  if (isShipmentCompleted(shipment)) return '合作完成'
  if (shipment.status === '已签收') return shipment.progress_status === '暂停/异常' ? '异常' : '内容跟进'
  return shipment.status
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    待寄出: 'bg-amber-50 text-amber-700',
    运输中: 'bg-blue-50 text-blue-700',
    已签收: 'bg-cyan-50 text-cyan-700',
    内容跟进: 'bg-rose-50 text-rose-700',
    待制作: 'bg-amber-50 text-amber-700',
    制作中: 'bg-sky-50 text-sky-700',
    待发布: 'bg-indigo-50 text-indigo-700',
    异常: 'bg-red-50 text-red-700',
    '暂停/异常': 'bg-red-50 text-red-700',
    进度异常: 'bg-red-50 text-red-700',
    合作完成: 'bg-emerald-50 text-emerald-700',
    已完成: 'bg-emerald-50 text-emerald-700',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export default function ShipmentBoard({ kols, invitations, shipments, onSelect, onUpdate, onShipmentsChange, onCollaborationsChange }: Props) {
  const [completingShipmentId, setCompletingShipmentId] = useState<string | null>(null)
  const [archivingShipment, setArchivingShipment] = useState<Shipment | null>(null)
  const [archiveExistingCollaboration, setArchiveExistingCollaboration] = useState<Collaboration | null>(null)
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({})
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null)
  const [boardError, setBoardError] = useState('')
  const [progressDraft, setProgressDraft] = useState<ProgressDraft>({
    progress_status: '待制作',
    progress_notes: '',
  })

  const kolMap = useMemo(() => new Map(kols.map(kol => [kol.id, kol])), [kols])

  const columns = useMemo<BoardColumn[]>(() => {
    const visibleShipments = shipments.filter(isShipmentVisible)
    const pending = visibleShipments.filter(shipment => shipment.status === '待寄出' && !shipment.tracking_number?.trim())
    const transit = visibleShipments.filter(shipment => shipment.status === '运输中' || (shipment.tracking_number?.trim() && shipment.status !== '已签收' && !isShipmentCompleted(shipment)))
    const inProgress = visibleShipments
      .filter(shipment => shipment.status === '已签收' && !isShipmentCompleted(shipment))
      .sort((a, b) => daysSince(b.delivered_at) - daysSince(a.delivered_at))
    const completed = visibleShipments
      .filter(shipment => isShipmentCompleted(shipment))
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))

    return [
      { key: 'pending', label: '待寄出', subtitle: '补齐物流单号', icon: PackageCheck, dot: 'bg-[#FF9F0A]', tint: 'bg-amber-50/60', shipments: pending },
      { key: 'transit', label: '运输中', subtitle: '等待签收确认', icon: Truck, dot: 'bg-[#0066FF]', tint: 'bg-blue-50/60', shipments: transit },
      { key: 'progress', label: '内容跟进', subtitle: '样品已签收', icon: Clock3, dot: 'bg-[#FF3B30]', tint: 'bg-rose-50/60', shipments: inProgress },
      { key: 'completed', label: '待归档', subtitle: '补作品数据', icon: Archive, dot: 'bg-[#34C759]', tint: 'bg-emerald-50/60', shipments: completed },
    ]
  }, [shipments])

  const totalActive = countActiveShipments(shipments)
  const overdueCount = columns.find(column => column.key === 'progress')?.shipments.filter(shipment => daysSince(shipment.delivered_at) >= 60).length || 0

  const getPaymentTerm = (shipment: Shipment) => {
    const matched = (invitations[shipment.kol_id] || []).find(invitation => invitation.product === shipment.product && invitation.quoted_fee?.trim())
    return matched?.quoted_fee?.trim() || ''
  }

  const syncKolStatus = async (kolId: string, status: string) => {
    await onUpdate(kolId, { status })
  }

  const handleFillTracking = async (shipment: Shipment) => {
    const trackingNumber = (trackingDrafts[shipment.id] || '').trim()
    if (!trackingNumber) return
    const saved = await updateShipment(shipment.id, { tracking_number: trackingNumber, status: '运输中' })
    await syncKolStatus(saved.kol_id, '运输中')
    await onShipmentsChange()
    setTrackingDrafts(prev => ({ ...prev, [shipment.id]: '' }))
  }

  const handleConfirmDelivered = async (shipment: Shipment) => {
    try {
      setBoardError('')
      const saved = await updateShipment(shipment.id, {
        status: '已签收',
        delivered_at: todayISO(),
        progress_status: shipment.progress_status || '待制作',
      })
      await syncKolStatus(saved.kol_id, kolMainStatus(saved))
      await onShipmentsChange()
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : '确认签收失败')
    }
  }

  const startEditProgress = (shipment: Shipment) => {
    setEditingProgressId(shipment.id)
    setProgressDraft({
      progress_status: shipment.progress_status || '待制作',
      progress_notes: shipment.progress_notes || '',
    })
  }

  const saveProgress = async (shipment: Shipment) => {
    try {
      setBoardError('')
      const saved = await updateShipment(shipment.id, {
        progress_status: progressDraft.progress_status,
        progress_notes: progressDraft.progress_notes.trim(),
      })
      await syncKolStatus(saved.kol_id, kolMainStatus(saved))
      await onShipmentsChange()
      setEditingProgressId(null)
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : '保存进度失败')
    }
  }

  const handleComplete = async (shipment: Shipment) => {
    const completedAt = todayISO()
    try {
      setBoardError('')
      setCompletingShipmentId(shipment.id)
      const saved = await updateShipment(shipment.id, {
        status: '已签收',
        delivered_at: shipment.delivered_at || completedAt,
        progress_status: '已完成',
        completed_at: completedAt,
      })
      await ensureCompletionCollaboration(saved)
      await syncKolStatus(saved.kol_id, '合作完成')
      await onCollaborationsChange()
      await onShipmentsChange()
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : '合作完成保存失败，状态未变更')
    } finally {
      setCompletingShipmentId(null)
    }
  }

  const openArchiveModal = async (shipment: Shipment) => {
    try {
      setBoardError('')
      const existingCollaborations = await getCollaborationsByKOL(shipment.kol_id)
      const existing = findCollaborationForShipment(existingCollaborations, shipment)
      setArchiveExistingCollaboration(existing)
      setArchivingShipment(shipment)
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : '加载合作历史失败')
    }
  }

  const handleArchive = async (data: ArchiveFormData) => {
    if (!archivingShipment) return
    try {
      setBoardError('')
      const collaborationPayload = {
        ...data,
        publish_date: data.publish_date || archivingShipment.completed_at || todayISO(),
        notes: withShipmentHistoryMarker(data.notes || '系统归档', archivingShipment.id),
      }
      if (archiveExistingCollaboration) {
        await updateCollaboration(archiveExistingCollaboration.id, collaborationPayload)
      } else {
        await createCollaboration({
          kol_id: archivingShipment.kol_id,
          product: archivingShipment.product,
          ...collaborationPayload,
        })
      }
      const archived = await updateShipment(archivingShipment.id, { archived_at: new Date().toISOString() })
      await syncKolStatus(archived.kol_id, '合作完成')
      await onCollaborationsChange()
      await onShipmentsChange()
      setArchivingShipment(null)
      setArchiveExistingCollaboration(null)
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : '正式归档失败')
    }
  }

  return (
    <>
      <section className="flex h-full min-h-0 flex-col overflow-hidden">
        {boardError && (
          <div className="fixed right-6 top-20 z-50 flex items-center gap-2 rounded-[12px] border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-lg">
            <AlertTriangle className="h-4 w-4" />
            <span>{boardError}</span>
            <button onClick={() => setBoardError('')} className="ml-2 font-bold hover:text-red-900">&times;</button>
          </div>
        )}

        <div className="mb-4 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <BoardMetric label="未完成" value={totalActive} tone="text-[#0066FF]" />
          <BoardMetric label="待寄出" value={columns[0]?.shipments.length || 0} tone="text-[#FF9F0A]" />
          <BoardMetric label="内容风险" value={overdueCount} tone="text-[#FF3B30]" />
          <BoardMetric label="待归档" value={columns[3]?.shipments.length || 0} tone="text-[#34C759]" />
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto">
          <div className="grid h-full min-w-[1180px] grid-cols-4 gap-4">
            {columns.map(column => {
              const Icon = column.icon
              return (
                <div key={column.key} className="flex min-h-0 flex-col overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                  <div className={`shrink-0 border-b border-black/[0.06] px-4 py-3 ${column.tint}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white text-[#1D1D1F] shadow-sm">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${column.dot}`} />
                            <h3 className="text-sm font-extrabold text-[#1D1D1F]">{column.label}</h3>
                          </div>
                          <p className="mt-0.5 text-[11px] font-semibold text-[#86868B]">{column.subtitle}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-[#1D1D1F]">{column.shipments.length}</span>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    {column.shipments.length === 0 ? (
                      <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-[14px] border border-dashed border-black/[0.08] text-center">
                        <Icon className="mb-2 h-5 w-5 text-[#AEAEB2]" />
                        <p className="text-xs font-bold text-[#86868B]">暂无记录</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {column.shipments.map(shipment => {
                          const kol = kolMap.get(shipment.kol_id)
                          const deliveredDays = daysSince(shipment.delivered_at)
                          const completedDays = daysSince(shipment.completed_at)
                          const overdue = column.key === 'progress' && deliveredDays >= 60
                          const paymentTerm = getPaymentTerm(shipment)
                          const isEditing = editingProgressId === shipment.id
                          const label = progressLabel(shipment)

                          return (
                            <article key={shipment.id} className={`rounded-[14px] border bg-white p-4 shadow-sm transition hover:shadow-md ${overdue ? 'border-red-200 shadow-red-50' : 'border-black/[0.06]'}`}>
                              <button onClick={() => kol && onSelect(kol)} className="block w-full text-left">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-[13px] font-extrabold text-[#1D1D1F]">{kol?.name || '未知 KOL'}</div>
                                    <div className="mt-0.5 truncate text-[11px] font-semibold text-[#86868B]">{kol ? `${kol.platform} · ${kol.followers || '-'}` : 'KOL 信息缺失'}</div>
                                  </div>
                                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadge(label)}`}>{label}</span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  <InfoPill>{shipment.product}</InfoPill>
                                  {paymentTerm && <InfoPill>{paymentTerm}</InfoPill>}
                                  {shipment.delivered_at && !isShipmentCompleted(shipment) && (
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${overdue ? 'bg-red-50 text-red-700' : 'bg-rose-50 text-rose-700'}`}>
                                      签收 {deliveredDays} 天
                                    </span>
                                  )}
                                  {shipment.completed_at && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">完成 {completedDays} 天</span>}
                                </div>

                                <div className="mt-3 space-y-1.5 text-[11px] font-semibold text-[#6E6E73]">
                                  {shipment.sample_date && <MetaLine label="寄样" value={shipment.sample_date} />}
                                  {shipment.tracking_number && <MetaLine label="单号" value={shipment.tracking_number} />}
                                  {shipment.shipping_details && <MetaLine label="收件" value={shipment.shipping_details} />}
                                  {shipment.notes && <MetaLine label="物流备注" value={shipment.notes} />}
                                </div>
                                {shipment.progress_notes && <div className="mt-3 rounded-[10px] border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{shipment.progress_notes}</div>}
                                {column.key === 'completed' && <div className="mt-3 rounded-[10px] border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">等待补充作品链接与效果数据</div>}
                              </button>

                              {isEditing && (
                                <div className="mt-3 border-t border-black/[0.06] pt-3">
                                  <div className="grid gap-2">
                                    <select
                                      value={progressDraft.progress_status}
                                      onChange={event => setProgressDraft(prev => ({ ...prev, progress_status: event.target.value }))}
                                      className="h-9 rounded-[10px] border border-black/[0.08] bg-white px-3 text-xs font-bold outline-none focus:border-[#0066FF]/40"
                                    >
                                      {PROGRESS_STATUSES.filter(status => status !== '已完成').map(status => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                    <textarea
                                      value={progressDraft.progress_notes}
                                      onChange={event => setProgressDraft(prev => ({ ...prev, progress_notes: event.target.value }))}
                                      placeholder="进度备注"
                                      rows={3}
                                      className="resize-none rounded-[10px] border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#0066FF]/40"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => setEditingProgressId(null)} className="h-8 rounded-[9px] px-3 text-xs font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">取消</button>
                                      <button onClick={() => saveProgress(shipment)} className="h-8 rounded-[9px] bg-[#1D1D1F] px-3 text-xs font-bold text-white">保存</button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-black/[0.06] pt-3">
                                {column.key === 'pending' && (
                                  <div className="flex w-full gap-2">
                                    <input
                                      value={trackingDrafts[shipment.id] || ''}
                                      onChange={event => setTrackingDrafts(prev => ({ ...prev, [shipment.id]: event.target.value }))}
                                      placeholder="快递单号"
                                      className="h-9 min-w-0 flex-1 rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 text-xs font-semibold outline-none focus:border-[#0066FF]/40 focus:bg-white"
                                    />
                                    <ActionButton onClick={() => handleFillTracking(shipment)} icon={Send} tone="primary">发出</ActionButton>
                                  </div>
                                )}
                                {column.key === 'transit' && <ActionButton onClick={() => handleConfirmDelivered(shipment)} icon={CheckCircle2} tone="primary">确认签收</ActionButton>}
                                {column.key === 'progress' && !isEditing && <ActionButton onClick={() => startEditProgress(shipment)} icon={Pencil}>更新进度</ActionButton>}
                                {column.key === 'progress' && !isShipmentCompleted(shipment) && (
                                  <ActionButton onClick={() => handleComplete(shipment)} icon={CheckCircle2} tone="success" disabled={completingShipmentId === shipment.id}>
                                    {completingShipmentId === shipment.id ? '标记中' : '合作完成'}
                                  </ActionButton>
                                )}
                                {column.key === 'completed' && <ActionButton onClick={() => openArchiveModal(shipment)} icon={Archive} tone="success">补数据归档</ActionButton>}
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {archivingShipment && (
        <ArchiveCollaborationModal
          shipment={archivingShipment}
          existing={archiveExistingCollaboration}
          contentShape={getKolContentShape(kolMap.get(archivingShipment.kol_id))}
          onClose={() => { setArchivingShipment(null); setArchiveExistingCollaboration(null) }}
          onSubmit={handleArchive}
        />
      )}
    </>
  )
}

function BoardMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-[14px] border border-black/[0.06] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className={`text-[22px] font-extrabold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-bold text-[#86868B]">{label}</div>
    </div>
  )
}

function InfoPill({ children }: { children: string }) {
  return <span className="rounded-full bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-bold text-[#6E6E73]">{children}</span>
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-[#AEAEB2]">{label}</span>
      <span className="line-clamp-2 text-[#6E6E73]">{value}</span>
    </div>
  )
}

function ActionButton({
  children,
  icon: Icon,
  onClick,
  tone = 'neutral',
  disabled = false,
}: {
  children: string
  icon: LucideIcon
  onClick: () => void
  tone?: 'neutral' | 'primary' | 'success'
  disabled?: boolean
}) {
  const className = tone === 'primary'
    ? 'bg-[#0066FF] text-white shadow-[0_2px_8px_rgba(0,102,255,0.25)]'
    : tone === 'success'
      ? 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(52,199,89,0.2)]'
      : 'bg-[#F5F5F7] text-[#1D1D1F]'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[11px] font-bold transition active:scale-95 disabled:opacity-50 ${className}`}
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}
