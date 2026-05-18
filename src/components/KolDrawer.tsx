import { useState, useEffect } from 'react'
import { KOL, Invitation, Collaboration, Shipment, PLATFORMS } from '../types'
import { getInvitationsByKOL, createInvitation, deleteInvitation, updateInvitation } from '../services/invitationService'
import { getCollaborationsByKOL, createCollaboration, deleteCollaboration, updateCollaboration } from '../services/collaborationService'
import { createShipment, updateShipment, deleteShipment, getShipmentsByKOL } from '../services/shipmentService'
import { countCompletedCollaborations, deriveKolStatus, hasPublishReadyCollaborationSignal, hasRealCollaborationSignal } from '../utils/kolStatus'
import InlineEdit from './InlineEdit'
import MailPanel from './MailPanel'
import AddInvitationModal, { InvitationFormData } from './AddInvitationModal'
import AddCollaborationModal, { CollaborationFormData } from './AddCollaborationModal'
import AddShipmentModal, { ShipmentFormData } from './AddShipmentModal'
import EditProgressModal, { ProgressFormData } from './EditProgressModal'

interface Props {
  kol: KOL
  shipments: Shipment[]
  collaborationCount: number
  onClose: () => void
  onUpdate: (id: string, updates: Partial<KOL>) => Promise<KOL> | KOL
  onInvitationsChange: () => Promise<void> | void
  onCollaborationsChange: () => Promise<void> | void
  onShipmentsChange: () => Promise<void> | void
}

export default function KolDrawer({ kol, shipments, onClose, onUpdate, onInvitationsChange, onCollaborationsChange, onShipmentsChange }: Props) {
  const [toast, setToast] = useState('')
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [collaborations, setCollaborations] = useState<Collaboration[]>([])
  const [loadingSub, setLoadingSub] = useState(true)
  const [showInvModal, setShowInvModal] = useState(false)
  const [showColModal, setShowColModal] = useState(false)
  const [showShipmentModal, setShowShipmentModal] = useState(false)
  const [editingInvitation, setEditingInvitation] = useState<Invitation | null>(null)
  const [editingCollaboration, setEditingCollaboration] = useState<Collaboration | null>(null)
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null)
  const [editingProgress, setEditingProgress] = useState<Shipment | null>(null)
  const [showMail, setShowMail] = useState(false)

  const kolShipments = shipments.filter(s => s.kol_id === kol.id)
  const completedCollaborations = collaborations.filter(hasRealCollaborationSignal)
  const publishReadyCollaborations = collaborations.filter(hasPublishReadyCollaborationSignal)
  const completedCollaborationCount = countCompletedCollaborations(collaborations)

  useEffect(() => { loadSubData() }, [kol.id])

  const loadSubData = async () => {
    setLoadingSub(true)
    try {
      const [invData, colData] = await Promise.all([
        getInvitationsByKOL(kol.id),
        getCollaborationsByKOL(kol.id),
      ])
      setInvitations(invData)
      setCollaborations(colData)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载详情数据失败')
    } finally { setLoadingSub(false) }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const shipmentStatus = (trackingNumber: string) => trackingNumber.trim() ? '运输中' : '待寄出'
  const INVITATION_ENTRY_STATUSES = ['未首触', '未回复', '拒绝合作', '沟通中', '']

  const nextKolStatus = (shipment: ShipmentFormData | Shipment) => {
    if ('completed_at' in shipment && shipment.completed_at) return '合作完成'
    if ('progress_status' in shipment && shipment.progress_status === '已完成') return '合作完成'
    if (shipment.status === '已签收') return shipment.progress_status === '暂停/异常' ? '异常' : '内容跟进'
    if (shipment.tracking_number?.trim() || shipment.status === '运输中') return '运输中'
    return '待寄出'
  }

  const syncKolSnapshot = async (shipment: ShipmentFormData | Shipment, status?: string) => {
    await onUpdate(kol.id, {
      sample_date: shipment.sample_date || null,
      tracking_number: shipment.tracking_number || '',
      shipping_details: shipment.shipping_details || '',
      status: status || nextKolStatus(shipment),
    })
  }

  const syncDerivedKolStatus = async (
    nextInvitations: Invitation[] = invitations,
    nextShipments: Shipment[] = kolShipments,
    nextCollaborations: Collaboration[] = collaborations
  ) => {
    const nextStatus = deriveKolStatus(kol, nextInvitations, nextShipments, nextCollaborations)
    await onUpdate(kol.id, { status: nextStatus })
  }

  const pushStatus = async (newStatus: string) => {
    await onUpdate(kol.id, { status: newStatus })
  }

  const save = async (field: keyof KOL, value: string | string[]) => {
    try {
      const normalizedValue = field === 'tags'
        ? (Array.isArray(value) ? value : [])
        : value
      await onUpdate(kol.id, { [field]: normalizedValue } as Partial<KOL>)
      showToast('已保存')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败')
    }
  }

  const saveTags = async (raw: string) => {
    const tags = raw.split(',').map(s => s.trim()).filter(Boolean)
    await save('tags', tags)
  }

  const shouldCreateShipmentFromInvitation = (invitation: Invitation) => {
    return invitation.replied && invitation.reply_result === '同意合作' && invitation.decision === '继续推进'
  }

  const ensureShipmentForInvitation = async (invitation: Invitation) => {
    if (!shouldCreateShipmentFromInvitation(invitation)) return false

    const existingShipments = await getShipmentsByKOL(kol.id)
    const hasSamePendingShipment = existingShipments.some(s =>
      s.product === invitation.product && s.status === '待寄出' && !s.tracking_number?.trim()
    )

    if (hasSamePendingShipment) return false

    await createShipment({
      kol_id: kol.id,
      product: invitation.product,
      sample_date: null,
      tracking_number: '',
      shipping_details: kol.shipping_details || '',
      status: '待寄出',
      notes: '邀约同意且我方继续推进后自动生成',
      delivered_at: null,
      progress_status: '待制作',
      progress_notes: '',
      expected_publish_date: null,
      completed_at: null,
      archived_at: null,
    })

    return true
  }

  const syncInvitationWorkflow = async (savedInvitation: Invitation, nextInvitations: Invitation[]) => {
    const createdShipment = await ensureShipmentForInvitation(savedInvitation)
    if (createdShipment) {
      await onShipmentsChange()
    }
    await syncDerivedKolStatus(nextInvitations)
  }

  const handleSaveShipment = async (data: ShipmentFormData) => {
    try {
      const payload = {
        ...data,
        status: data.status === '已签收' ? '已签收' : shipmentStatus(data.tracking_number),
        delivered_at: data.status === '已签收' ? data.delivered_at : null,
        expected_publish_date: null,
        archived_at: editingShipment?.archived_at ?? null,
      }
      const saved = editingShipment
        ? await updateShipment(editingShipment.id, payload)
        : await createShipment(payload)
      await syncKolSnapshot(saved)
      await onShipmentsChange()
      setShowShipmentModal(false)
      setEditingShipment(null)
      showToast(editingShipment ? '寄样已更新' : '寄样已新增')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '寄样保存失败')
    }
  }

  const resetKolAfterShipmentDelete = async (deletedShipmentId: string) => {
    const remaining = kolShipments.filter(s => s.id !== deletedShipmentId)
    const latest = remaining.reduce<Shipment | null>((current, shipment) => {
      if (!current) return shipment
      const shipmentTime = shipment.sample_date || shipment.delivered_at || shipment.created_at || ''
      const currentTime = current.sample_date || current.delivered_at || current.created_at || ''
      return shipmentTime > currentTime ? shipment : current
    }, null)

    if (latest) {
      await syncKolSnapshot(latest)
      return
    }

    const latestInvitation = invitations[0]
    const fallbackStatus = latestInvitation
      ? deriveKolStatus(kol, [latestInvitation], [], collaborations)
      : '未首触'

    await onUpdate(kol.id, {
      sample_date: null,
      tracking_number: '',
      shipping_details: '',
      status: fallbackStatus,
    })
  }

  const handleDeleteShipment = async (shipment: Shipment) => {
    if (!confirm('删除该寄样记录？')) return
    try {
      await deleteShipment(shipment.id)
      await resetKolAfterShipmentDelete(shipment.id)
      await onShipmentsChange()
      showToast('寄样已删除')
    } catch {
      showToast('删除失败')
    }
  }

  const handleConfirmDelivered = async (shipment: Shipment) => {
    try {
      const saved = await updateShipment(shipment.id, {
        status: '已签收',
        delivered_at: new Date().toISOString().slice(0, 10),
        progress_status: shipment.progress_status || '待制作',
      })
      await syncKolSnapshot(saved, nextKolStatus(saved))
      await onShipmentsChange()
      showToast('已进入已送达待推进')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '更新失败')
    }
  }

  const handleSaveProgress = async (data: ProgressFormData) => {
    if (!editingProgress) return
    try {
      const saved = await updateShipment(editingProgress.id, data)
      await syncKolSnapshot(saved, nextKolStatus(saved))
      await onShipmentsChange()
      setEditingProgress(null)
      showToast('内容进度已保存')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '内容进度保存失败')
    }
  }

  const handleAddInvitation = async (data: InvitationFormData) => {
    try {
      if (editingInvitation) {
        const saved = await updateInvitation(editingInvitation.id, data)
        const next = invitations.map(inv => inv.id === saved.id ? saved : inv)
        setInvitations(next)
        setShowInvModal(false)
        setEditingInvitation(null)
        await syncInvitationWorkflow(saved, next)
        await onInvitationsChange()
        showToast('邀约已更新')
        return
      }

      const inv = await createInvitation(data)
      const updated = [inv, ...invitations]
      setInvitations(updated)
      setShowInvModal(false)
      await syncInvitationWorkflow(inv, updated)
      if (INVITATION_ENTRY_STATUSES.includes(kol.status) && (!inv.replied || inv.reply_result === '未回复')) {
        await pushStatus('已邀约')
      }
      await onInvitationsChange()
      showToast('邀约已添加')
    } catch (err) { showToast(err instanceof Error ? err.message : editingInvitation ? '更新失败' : '添加失败') }
  }

  const handleReplyUpdate = async (inv: Invitation, result: string) => {
    try {
      const saved = await updateInvitation(inv.id, { replied: true, reply_result: result })
      const next = invitations.map(i => i.id === saved.id ? saved : i)
      setInvitations(next)
      await syncInvitationWorkflow(saved, next)
      showToast('回复已更新')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '更新失败')
    }
  }

  const handleDeleteInvitation = async (id: string) => {
    if (!confirm('删除该邀约记录？')) return
    try {
      await deleteInvitation(id)
      const next = invitations.filter(i => i.id !== id)
      setInvitations(next)
      await syncDerivedKolStatus(next)
      await onInvitationsChange()
      showToast('邀约已删除')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败')
    }
  }

  const handleAddCollaboration = async (data: CollaborationFormData) => {
    try {
      if (editingCollaboration) {
        const saved = await updateCollaboration(editingCollaboration.id, data)
        const next = collaborations.map(col => col.id === saved.id ? saved : col)
        setCollaborations(next)
        setShowColModal(false)
        setEditingCollaboration(null)
        await syncDerivedKolStatus(invitations, kolShipments, next)
        await onCollaborationsChange()
        showToast('合作已更新')
        return
      }

      const col = await createCollaboration(data)
      const next = [col, ...collaborations]
      setCollaborations(next)
      setShowColModal(false)
      await syncDerivedKolStatus(invitations, kolShipments, next)
      await onCollaborationsChange()
      showToast('合作已添加')
    } catch (err) { showToast(err instanceof Error ? err.message : editingCollaboration ? '更新失败' : '添加失败') }
  }

  const handleDeleteCollaboration = async (id: string) => {
    if (!confirm('删除该合作记录？')) return
    try {
      await deleteCollaboration(id)
      const next = collaborations.filter(c => c.id !== id)
      setCollaborations(next)
      await syncDerivedKolStatus(invitations, kolShipments, next)
      await onCollaborationsChange()
      showToast('合作已删除')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败')
    }
  }

  const invReplyBadge = (inv: Invitation) => {
    if (!inv.replied) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-medium">未回复</span>
    if (inv.reply_result.includes('同意')) return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-medium">已同意</span>
    if (inv.reply_result.includes('拒绝')) return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-medium">已拒绝</span>
    if (inv.reply_result === '未回复') return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-medium">未回复</span>
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-medium">{inv.reply_result}</span>
  }

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      '未首触': 'bg-gray-100 text-gray-600', '已邀约': 'bg-purple-100 text-purple-700',
      '待寄出': 'bg-orange-100 text-orange-700', '运输中': 'bg-blue-100 text-blue-700',
      '已签收': 'bg-teal-100 text-teal-700', '内容跟进': 'bg-rose-100 text-rose-700',
      '待制作': 'bg-amber-100 text-amber-700', '制作中': 'bg-sky-100 text-sky-700',
      '待发布': 'bg-cyan-100 text-cyan-700', '进度异常': 'bg-red-100 text-red-700',
      '异常': 'bg-red-100 text-red-700', '暂停/异常': 'bg-red-100 text-red-700',
      '合作完成': 'bg-green-100 text-green-700', '拒绝合作': 'bg-red-100 text-red-700',
    }
    return `px-2 py-0.5 rounded-full text-[11px] font-medium ${map[s] || 'bg-gray-100 text-gray-600'}`
  }

  const fmt = (n: number | null) => {
    if (!n) return null
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return String(n)
  }

  const shipmentProgressLabel = (shipment: Shipment) => {
    if (shipment.completed_at || shipment.progress_status === '已完成') return '合作完成'
    if (shipment.status === '已签收') return shipment.progress_status || '待制作'
    return '未开始'
  }

  const shipmentStepState = (shipment: Shipment, step: 'sample' | 'transit' | 'delivered' | 'content' | 'done') => {
    const completed = Boolean(shipment.completed_at) || shipment.progress_status === '已完成'
    const hasTracking = Boolean(shipment.tracking_number?.trim()) || shipment.status === '运输中' || shipment.status === '已签收'
    const delivered = shipment.status === '已签收'

    if (step === 'sample') return shipment.sample_date || hasTracking || delivered || completed ? 'done' : 'current'
    if (step === 'transit') {
      if (delivered || completed) return 'done'
      if (hasTracking) return 'current'
      return 'todo'
    }
    if (step === 'delivered') {
      if (completed) return 'done'
      if (delivered) return 'done'
      return 'todo'
    }
    if (step === 'content') {
      if (completed) return 'done'
      if (delivered) return 'current'
      return 'todo'
    }
    if (step === 'done') return completed ? 'done' : 'todo'
    return 'todo'
  }

  const stepClass = (state: string) => {
    if (state === 'done') return 'bg-emerald-500 text-white border-emerald-500'
    if (state === 'current') return 'bg-rose-500 text-white border-rose-500 shadow-sm shadow-rose-100'
    return 'bg-gray-50 text-gray-400 border-gray-200'
  }

  const latestInvitation = invitations[0]

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="ml-auto relative w-[90%] max-w-[1400px] bg-white shadow-2xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-8 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-lg shadow-inner">
            {kol.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">{kol.name}</h2>
              <span className={statusLabel(kol.status)}>{kol.status}</span>
              {completedCollaborationCount > 0 && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/25">合作过 {completedCollaborationCount} 次</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-purple-200 text-sm">
              <span>{kol.platform}</span><span className="opacity-40">|</span>
              <span>{kol.followers}</span><span className="opacity-40">|</span>
              <span>{kol.country}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
              <SectionCard icon="👤" title="基础身份" accent="border-l-indigo-500" bg="bg-white">
                <FieldGrid>
                  <InlineEdit label="博主名称" value={kol.name} onSave={v => save('name', v)} />
                  <InlineEdit label="联系邮箱" value={kol.email} onSave={v => save('email', v)} />
                  <InlineEdit label="核心平台" value={kol.platform} onSave={v => save('platform', v)} type="select" options={PLATFORMS} />
                  <InlineEdit label="主页链接" value={kol.homepage_url} onSave={v => save('homepage_url', v)} />
                  <InlineEdit label="粉丝量级" value={kol.followers} onSave={v => save('followers', v)} />
                  <InlineEdit label="国家/地区" value={kol.country} onSave={v => save('country', v)} />
                  <InlineEdit label="领域标签" value={kol.tags.join(', ')} onSave={saveTags} />
                </FieldGrid>
              </SectionCard>

              <SectionCard icon="🧭" title="当前合作链路" accent="border-l-rose-500" bg="bg-white"
                action={<button onClick={() => { setEditingShipment(null); setShowShipmentModal(true) }} className="text-xs px-3 py-1.5 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors font-medium">+ 新增寄样</button>}
              >
                {kolShipments.length === 0 ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/50 px-4 py-6 text-center">
                      <p className="text-sm font-medium text-rose-700">暂无进行中的合作链路</p>
                      <p className="text-xs text-gray-400 mt-1">邀约同意后会自动生成待寄出记录，也可以手动新增寄样。</p>
                    </div>
                    {latestInvitation && (
                      <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 text-xs text-purple-700">
                        最近邀约：{latestInvitation.product} · {latestInvitation.replied ? latestInvitation.reply_result : '未回复'} · {latestInvitation.invited_at}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[620px] overflow-y-auto pr-1">
                    {kolShipments.map(shipment => {
                      const contentLabel = shipmentProgressLabel(shipment)
                      const steps = [
                        { key: 'sample', label: '寄样', meta: shipment.sample_date || '待补日期' },
                        { key: 'transit', label: '运输', meta: shipment.tracking_number || '待填单号' },
                        { key: 'delivered', label: '签收', meta: shipment.delivered_at || '待确认' },
                        { key: 'content', label: '内容', meta: contentLabel },
                        { key: 'done', label: '完成', meta: shipment.completed_at || '未归档' },
                      ] as const

                      return (
                        <div key={shipment.id} className="rounded-2xl border border-rose-100 bg-gradient-to-br from-white to-rose-50/40 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900">📦 {shipment.product}</span>
                                <span className={statusLabel(kol.status)}>{kol.status}</span>
                                <span className={statusLabel(contentLabel)}>{contentLabel}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-1">创建于 {shipment.created_at?.slice(0, 10)} · 物流 {shipment.status || '-'}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                              {shipment.status === '运输中' && (
                                <button onClick={() => handleConfirmDelivered(shipment)} className="text-[11px] px-2.5 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600">确认签收</button>
                              )}
                              <button onClick={() => { setEditingShipment(shipment); setShowShipmentModal(true) }} className="text-[11px] px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200">编辑物流</button>
                              <button onClick={() => setEditingProgress(shipment)} className="text-[11px] px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200">编辑进度</button>
                              <button onClick={() => handleDeleteShipment(shipment)} className="text-[11px] px-2.5 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">删除</button>
                            </div>
                          </div>

                          <div className="grid grid-cols-5 gap-2 mb-4">
                            {steps.map((step, index) => {
                              const state = shipmentStepState(shipment, step.key)
                              return (
                                <div key={step.key} className="relative">
                                  {index > 0 && <div className="absolute top-4 -left-2 w-2 h-px bg-gray-200" />}
                                  <div className={`rounded-xl border px-2 py-2 text-center min-h-[70px] ${stepClass(state)}`}>
                                    <div className="text-xs font-semibold">{step.label}</div>
                                    <div className="text-[10px] mt-1 opacity-80 truncate" title={step.meta}>{step.meta}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div className="bg-white/80 rounded-lg px-2 py-1.5">📅 寄样日期：{shipment.sample_date || '-'}</div>
                            <div className="bg-white/80 rounded-lg px-2 py-1.5">📮 快递单号：{shipment.tracking_number || '-'}</div>
                            <div className="bg-white/80 rounded-lg px-2 py-1.5">📍 收件信息：{shipment.shipping_details || '-'}</div>
                            <div className="bg-white/80 rounded-lg px-2 py-1.5">📌 内容进度：{contentLabel}</div>
                            <div className="bg-white/80 rounded-lg px-2 py-1.5">✅ 完成日期：{shipment.completed_at || '-'}</div>
                          </div>
                          {shipment.notes && <p className="mt-2 text-[11px] text-gray-500 border-t border-rose-100 pt-2">物流备注：{shipment.notes}</p>}
                          {shipment.progress_notes && <p className="mt-2 text-[11px] text-rose-700 bg-white/70 border border-rose-100 rounded-lg px-2 py-1.5">进度备注：{shipment.progress_notes}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard icon="📩" title="邀约记录" accent="border-l-purple-500" bg="bg-white"
                action={<button onClick={() => { setEditingInvitation(null); setShowInvModal(true) }} className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium">+ 发起邀约</button>}
              >
                {loadingSub ? (
                  <div className="space-y-2">{ [1,2].map(i => <div key={i} className="h-12 bg-purple-50 rounded-lg animate-pulse" />) }</div>
                ) : invitations.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">暂无邀约，点击发起</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {invitations.map(inv => (
                      <div key={inv.id} className="flex items-center gap-3 p-3 bg-purple-50/50 rounded-lg border border-purple-100 hover:border-purple-200 transition-colors group">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        <span className="text-gray-500 text-xs w-20 shrink-0">{inv.invited_at}</span>
                        <span className="font-semibold text-purple-700 text-xs w-12 shrink-0">{inv.product}</span>
                        <span className="text-gray-600 text-xs flex-1 truncate">
                          {inv.quoted_fee ? `报价 ${inv.quoted_fee}` : inv.notes || '-'}
                          {inv.decision && inv.decision !== '待评估' ? ` · ${inv.decision}` : ''}
                          {inv.decision_reason ? `（${inv.decision_reason}）` : ''}
                        </span>
                        {invReplyBadge(inv)}
                        {!inv.replied && (
                          <select value="" onChange={e => { if (e.target.value) handleReplyUpdate(inv, e.target.value) }} className="text-xs border border-purple-200 rounded px-1 py-0.5 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                            <option value="">标记</option><option value="同意合作">同意</option><option value="拒绝合作">拒绝</option><option value="未回复">未回复</option>
                          </select>
                        )}
                        <button onClick={() => { setEditingInvitation(inv); setShowInvModal(true) }} className="opacity-0 group-hover:opacity-100 text-xs text-purple-500 hover:text-purple-700 transition-all shrink-0">编辑</button>
                        <button onClick={() => handleDeleteInvitation(inv.id)} className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition-all shrink-0">删除</button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard icon="📊" title="合作历史" accent="border-l-teal-500" bg="bg-white"
                action={<button onClick={() => { setEditingCollaboration(null); setShowColModal(true) }} className="text-xs px-3 py-1.5 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors font-medium">+ 添加合作</button>}
              >
                {loadingSub ? (
                  <div className="space-y-2">{ [1,2].map(i => <div key={i} className="h-16 bg-teal-50 rounded-lg animate-pulse" />) }</div>
                ) : completedCollaborations.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">暂无已完成合作记录</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {publishReadyCollaborations.length === 0 && completedCollaborations.some(col => col.notes?.includes('系统归档')) && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                        已有系统归档记录，但缺少发布日期、作品链接或播放数据。请在进度看板完成归档后补填作品信息，补齐后会出现在合作历史列表。
                      </div>
                    )}
                    {publishReadyCollaborations.map(col => (
                      <div key={col.id} className="p-3 bg-teal-50/50 rounded-lg border border-teal-100 hover:border-teal-200 transition-colors group">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-teal-700 text-sm">{col.product}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{col.publish_date}</span>
                            <button onClick={() => { setEditingCollaboration(col); setShowColModal(true) }} className="opacity-0 group-hover:opacity-100 text-xs text-teal-600 hover:text-teal-800 transition-all">编辑</button>
                            <button onClick={() => handleDeleteCollaboration(col.id)} className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition-all">删除</button>
                          </div>
                        </div>
                        <div className="flex gap-2 text-sm text-gray-700 mb-2 flex-wrap">
                          {col.views !== null && col.views !== undefined ? <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full text-xs font-semibold"><span className="text-base leading-none">▶</span>{fmt(col.views)}</span> : null}
                          {col.comments !== null && col.comments !== undefined ? <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full text-xs font-semibold"><span className="text-base leading-none">💬</span>{fmt(col.comments)}</span> : null}
                          {col.likes !== null && col.likes !== undefined ? <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full text-xs font-semibold"><span className="text-base leading-none">❤️</span>{fmt(col.likes)}</span> : null}
                          {col.fee ? <span className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full text-xs font-semibold"><span className="text-base leading-none">💰</span>{col.fee}</span> : null}
                        </div>
                        {col.work_url && <a href={col.work_url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-500 hover:underline block truncate">{col.work_url}</a>}
                        {col.notes && <p className="text-[11px] text-gray-400 mt-1 border-t border-teal-100 pt-1">{col.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <div>
                <button onClick={() => setShowMail(!showMail)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  <span>{showMail ? '▼' : '▶'}</span> ✉️ 邮件往来
                </button>
                {showMail && <div className="mt-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm max-h-[400px] overflow-hidden"><MailPanel kolEmail={kol.email} kolId={kol.id} /></div>}
              </div>
            </div>
          </div>
        </div>

        {toast && <div className="fixed bottom-6 right-6 z-[60] px-5 py-2.5 bg-gray-900 text-white text-sm rounded-xl shadow-lg">{toast}</div>}
      </div>

      {showInvModal && <AddInvitationModal kolId={kol.id} invitation={editingInvitation} onClose={() => { setShowInvModal(false); setEditingInvitation(null) }} onSubmit={handleAddInvitation} />}
      {showColModal && <AddCollaborationModal kolId={kol.id} collaboration={editingCollaboration} onClose={() => { setShowColModal(false); setEditingCollaboration(null) }} onSubmit={handleAddCollaboration} />}
      {showShipmentModal && <AddShipmentModal kolId={kol.id} shipment={editingShipment} onClose={() => { setShowShipmentModal(false); setEditingShipment(null) }} onSubmit={handleSaveShipment} />}
      {editingProgress && <EditProgressModal shipment={editingProgress} onClose={() => setEditingProgress(null)} onSubmit={handleSaveProgress} />}
    </div>
  )
}

function SectionCard({ icon, title, accent, bg, action, children }: {
  icon: string; title: string; accent: string; bg: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className={`rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${bg} ${accent} border-l-4`}>
      <div className="px-5 py-3 border-b border-gray-100/80 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><span>{icon}</span> {title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-5 gap-y-3">{children}</div>
}
