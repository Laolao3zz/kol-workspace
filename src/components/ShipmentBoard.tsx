import { useMemo, useState } from 'react'
import { KOL, PROGRESS_STATUSES, Shipment, Collaboration, Invitation } from '../types'
import { createCollaboration, getCollaborationsByKOL, updateCollaboration } from '../services/collaborationService'
import { updateShipment } from '../services/shipmentService'
import ArchiveCollaborationModal, { ArchiveFormData } from './ArchiveCollaborationModal'

interface Props {
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  onSelect: (kol: KOL) => void
  onUpdate: (id: string, updates: Partial<KOL>) => Promise<KOL> | KOL
  onShipmentsChange: () => Promise<void> | void
}

type ProgressDraft = {
  progress_status: string
  progress_notes: string
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

export default function ShipmentBoard({ kols, invitations, shipments, onSelect, onUpdate, onShipmentsChange }: Props) {
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

  const kolMap = useMemo(() => new Map(kols.map(k => [k.id, k])), [kols])

  const columns = useMemo(() => {
    const visibleShipments = shipments.filter(isShipmentVisible)
    const pending = visibleShipments.filter(s => s.status === '待寄出' && !s.tracking_number?.trim())
    const transit = visibleShipments.filter(s => s.status === '运输中' || (s.tracking_number?.trim() && s.status !== '已签收' && !isShipmentCompleted(s)))
    const inProgress = visibleShipments
      .filter(s => s.status === '已签收' && !isShipmentCompleted(s))
      .sort((a, b) => daysSince(b.delivered_at) - daysSince(a.delivered_at))
    const completed = visibleShipments
      .filter(s => isShipmentCompleted(s))
      .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))

    return [
      { key: 'pending', label: '待寄出', icon: '📋', color: 'border-l-amber-500', bg: 'bg-amber-50/30', shipments: pending },
      { key: 'transit', label: '运输中', icon: '🚚', color: 'border-l-blue-500', bg: 'bg-blue-50/30', shipments: transit },
      { key: 'progress', label: '已送达待推进', icon: '⏱️', color: 'border-l-rose-500', bg: 'bg-rose-50/30', shipments: inProgress },
      { key: 'completed', label: '合作完成', icon: '✅', color: 'border-l-emerald-500', bg: 'bg-emerald-50/30', shipments: completed },
    ]
  }, [shipments])

  const getPaymentTerm = (shipment: Shipment) => {
    const matched = (invitations[shipment.kol_id] || []).find(inv => inv.product === shipment.product && inv.quoted_fee?.trim())
    return matched?.quoted_fee?.trim() || ''
  }

  const syncKolSnapshot = async (shipment: Shipment, status: string) => {
    await onUpdate(shipment.kol_id, {
      sample_date: shipment.sample_date || null,
      tracking_number: shipment.tracking_number || '',
      shipping_details: shipment.shipping_details || '',
      status,
    })
  }

  const handleFillTracking = async (shipment: Shipment) => {
    const trackingNumber = (trackingDrafts[shipment.id] || '').trim()
    if (!trackingNumber) return
    const saved = await updateShipment(shipment.id, { tracking_number: trackingNumber, status: '运输中' })
    await syncKolSnapshot(saved, '运输中')
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
      await syncKolSnapshot(saved, kolMainStatus(saved))
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
      await syncKolSnapshot(saved, kolMainStatus(saved))
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
        progress_status: '已完成',
        completed_at: completedAt,
      })
      await syncKolSnapshot(saved, '合作完成')
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
      const existing = existingCollaborations.find(col => col.product === shipment.product) || null
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
      if (archiveExistingCollaboration) {
        await updateCollaboration(archiveExistingCollaboration.id, data)
      } else {
        await createCollaboration({
          kol_id: archivingShipment.kol_id,
          product: archivingShipment.product,
          ...data,
        })
      }
      await updateShipment(archivingShipment.id, { archived_at: new Date().toISOString() })
      await onShipmentsChange()
      setArchivingShipment(null)
      setArchiveExistingCollaboration(null)
    } catch (err) {
      setBoardError(err instanceof Error ? err.message : '正式归档失败')
    }
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      '待寄出': 'bg-orange-100 text-orange-700', '运输中': 'bg-blue-100 text-blue-700',
      '已签收': 'bg-teal-100 text-teal-700', '内容跟进': 'bg-rose-100 text-rose-700',
      '待制作': 'bg-amber-100 text-amber-700', '制作中': 'bg-sky-100 text-sky-700',
      '待发布': 'bg-cyan-100 text-cyan-700', '异常': 'bg-red-100 text-red-700',
      '暂停/异常': 'bg-red-100 text-red-700', '进度异常': 'bg-red-100 text-red-700',
      '合作完成': 'bg-green-100 text-green-700', '已完成': 'bg-green-100 text-green-700',
    }
    return map[s] || 'bg-gray-100 text-gray-600'
  }

  return (
    <>
      <div className="flex gap-4 h-[calc(100vh-140px)]">
        {boardError && (
          <div className="fixed top-20 right-6 z-50 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl shadow-lg">
            {boardError}
            <button onClick={() => setBoardError('')} className="ml-3 font-bold hover:text-red-900">&times;</button>
          </div>
        )}
        {columns.map(col => (
          <div key={col.key} className={`flex-1 flex flex-col rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${col.bg} ${col.color} border-l-4`}>
            <div className="shrink-0 px-5 py-3 border-b border-gray-200/80 bg-white/60 backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><span>{col.icon}</span> {col.label}</h3>
                <span className="text-xs font-medium text-gray-400 bg-white px-2.5 py-0.5 rounded-full border border-gray-200">{col.shipments.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {col.shipments.length === 0 ? (
                <div className="text-center py-12"><p className="text-2xl mb-2 opacity-30">{col.icon}</p><p className="text-xs text-gray-400">暂无</p></div>
              ) : (
                col.shipments.map(shipment => {
                  const kol = kolMap.get(shipment.kol_id)
                  const deliveredDays = daysSince(shipment.delivered_at)
                  const completedDays = daysSince(shipment.completed_at)
                  const overdue = col.key === 'progress' && deliveredDays >= 60
                  const paymentTerm = getPaymentTerm(shipment)
                  const isEditing = editingProgressId === shipment.id
                  return (
                    <div key={shipment.id} className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${overdue ? 'border-red-200 shadow-red-100' : 'border-gray-100 hover:shadow-md hover:border-gray-200'}`}>
                      <div onClick={() => kol && onSelect(kol)} className="cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">{kol?.name || '未知 KOL'}</h4>
                            <p className="text-[11px] text-gray-500">{kol ? `${kol.platform} · ${kol.followers}` : 'KOL 信息缺失'}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${statusBadge(progressLabel(shipment))}`}>{progressLabel(shipment)}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-gray-600 mb-1 flex-wrap">
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">📦 {shipment.product}</span>
                          {paymentTerm && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">💰 {paymentTerm}</span>}
                          {shipment.delivered_at && !isShipmentCompleted(shipment) && <span className={`px-1.5 py-0.5 rounded font-medium ${overdue ? 'bg-red-100 text-red-700' : 'bg-rose-100 text-rose-700'}`}>送达 {deliveredDays} 天</span>}
                          {shipment.completed_at && <span className="px-1.5 py-0.5 rounded font-medium bg-green-100 text-green-700">完成 {completedDays} 天</span>}
                        </div>
                        {shipment.sample_date && <div className="text-[11px] text-gray-500 mb-1">📅 寄样 {shipment.sample_date}</div>}
                        {shipment.tracking_number && <div className="text-[11px] text-gray-500 mb-1">📮 {shipment.tracking_number}</div>}
                        {shipment.shipping_details && <div className="text-[11px] text-gray-400 mt-1 line-clamp-2">📍 {shipment.shipping_details}</div>}
                        {shipment.notes && <div className="text-[11px] text-gray-400 mt-1">物流备注：{shipment.notes}</div>}
                        {shipment.progress_notes && <div className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5">进度备注：{shipment.progress_notes}</div>}
                        {col.key === 'completed' && <div className="mt-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5">等待效果数据：补充播放量、评论、点赞、作品链接后可正式归档。</div>}
                      </div>

                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          <select value={progressDraft.progress_status} onChange={e => setProgressDraft(prev => ({ ...prev, progress_status: e.target.value }))} className="w-full text-xs px-2 py-1.5 border border-rose-200 rounded-lg">
                            {PROGRESS_STATUSES.filter(s => s !== '已完成').map(status => <option key={status} value={status}>{status}</option>)}
                          </select>
                          <textarea value={progressDraft.progress_notes} onChange={e => setProgressDraft(prev => ({ ...prev, progress_notes: e.target.value }))} placeholder="送达后的制作进度、异常原因、下一步跟进..." rows={3} className="w-full text-xs px-2 py-1.5 border border-rose-200 rounded-lg resize-y" />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingProgressId(null)} className="text-[11px] px-2.5 py-1 text-gray-500 hover:bg-gray-100 rounded-lg">取消</button>
                            <button onClick={() => saveProgress(shipment)} className="text-[11px] px-2.5 py-1 bg-rose-500 text-white rounded-lg hover:bg-rose-600">保存进度</button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2">
                        {col.key === 'pending' && (
                          <div className="flex gap-2 w-full">
                            <input value={trackingDrafts[shipment.id] || ''} onChange={e => setTrackingDrafts(prev => ({ ...prev, [shipment.id]: e.target.value }))} placeholder="补充快递单号" className="min-w-0 flex-1 text-[11px] px-2 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400" />
                            <button onClick={() => handleFillTracking(shipment)} className="text-[11px] px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium shrink-0">发出</button>
                          </div>
                        )}
                        {col.key === 'transit' && <button onClick={(e) => { e.stopPropagation(); handleConfirmDelivered(shipment) }} className="text-[11px] px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">确认签收</button>}
                        {col.key === 'progress' && !isEditing && (
                          <button onClick={(e) => { e.stopPropagation(); startEditProgress(shipment) }} className="text-[11px] px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors font-medium">更新进度</button>
                        )}
                        {col.key === 'progress' && !isShipmentCompleted(shipment) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleComplete(shipment) }}
                            disabled={completingShipmentId === shipment.id}
                            className="text-[11px] px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium disabled:opacity-60"
                          >
                            {completingShipmentId === shipment.id ? '标记中...' : '标记合作完成'}
                          </button>
                        )}
                        {col.key === 'completed' && (
                          <button onClick={(e) => { e.stopPropagation(); openArchiveModal(shipment) }} className="text-[11px] px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium">补数据并正式归档</button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {archivingShipment && (
        <ArchiveCollaborationModal
          shipment={archivingShipment}
          existing={archiveExistingCollaboration}
          onClose={() => { setArchivingShipment(null); setArchiveExistingCollaboration(null) }}
          onSubmit={handleArchive}
        />
      )}
    </>
  )
}
