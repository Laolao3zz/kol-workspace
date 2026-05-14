import { useState, useEffect } from 'react'
import { KOL, Invitation, Collaboration, Shipment } from '../types'
import { getInvitationsByKOL, createInvitation, deleteInvitation, updateInvitation } from '../services/invitationService'
import { getCollaborationsByKOL, createCollaboration, deleteCollaboration, updateCollaboration } from '../services/collaborationService'
import { createShipment, updateShipment, deleteShipment, getShipmentsByKOL } from '../services/shipmentService'
import { applyKolSnapshot, deriveKolStatus } from '../utils/kolStatus'
import InlineEdit from './InlineEdit'
import MailPanel from './MailPanel'
import AddInvitationModal, { InvitationFormData } from './AddInvitationModal'
import AddCollaborationModal, { CollaborationFormData } from './AddCollaborationModal'
import AddShipmentModal, { ShipmentFormData } from './AddShipmentModal'

interface Props {
  kol: KOL
  shipments: Shipment[]
  collaborationCount: number
  onClose: () => void
  onUpdate: (kol: KOL) => Promise<void> | void
  onInvitationsChange: () => Promise<void> | void
  onCollaborationsChange: () => Promise<void> | void
  onShipmentsChange: () => Promise<void> | void
}

export default function KolDrawer({ kol, shipments, collaborationCount, onClose, onUpdate, onInvitationsChange, onCollaborationsChange, onShipmentsChange }: Props) {
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
  const [showMail, setShowMail] = useState(false)

  const kolShipments = shipments.filter(s => s.kol_id === kol.id)

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
    } catch {} finally { setLoadingSub(false) }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const shipmentStatus = (trackingNumber: string) => trackingNumber.trim() ? '运输中' : '待寄出'
  const INVITATION_ENTRY_STATUSES = ['未首触', '未回复', '拒绝合作', '沟通中', '']

  const nextKolStatus = (shipment: ShipmentFormData | Shipment) => {
    if (shipment.status === '已签收') return '已签收'
    if (shipment.tracking_number?.trim()) return '运输中'
    return '待寄出'
  }

  const syncKolSnapshot = async (shipment: ShipmentFormData | Shipment, status?: string) => {
    await onUpdate({
      ...kol,
      sample_product: shipment.product,
      sample_date: shipment.sample_date || null,
      tracking_number: shipment.tracking_number || '',
      shipping_details: shipment.shipping_details || '',
      status: status || nextKolStatus(shipment),
      updated_at: new Date().toISOString(),
    })
  }

  const syncDerivedKolStatus = async (
    nextInvitations: Invitation[] = invitations,
    nextShipments: Shipment[] = kolShipments,
    nextCollaborations: Collaboration[] = collaborations
  ) => {
    const nextStatus = deriveKolStatus(kol, nextInvitations, nextShipments, nextCollaborations)
    await onUpdate(applyKolSnapshot({ ...kol, status: nextStatus }, nextInvitations, nextShipments, nextCollaborations))
  }

  const pushStatus = (newStatus: string) => {
    const updated = { ...kol, status: newStatus, updated_at: new Date().toISOString() }
    onUpdate(updated)
  }

  const save = async (field: keyof KOL, value: string | string[]) => {
    try {
      const updated = { ...kol, [field]: value, updated_at: new Date().toISOString() }
      await onUpdate(updated)
      showToast('已保存')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败')
    }
  }

  const saveTags = async (raw: string) => {
    const tags = raw.split(',').map(s => s.trim()).filter(Boolean)
    await save('tags', tags)
  }

  const handleSaveShipment = async (data: ShipmentFormData) => {
    try {
      const payload = { ...data, status: data.status === '已签收' ? '已签收' : shipmentStatus(data.tracking_number) }
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
    const latest = remaining[0]

    if (latest) {
      await syncKolSnapshot(latest)
      return
    }

    const latestInvitation = invitations[0]
    let fallbackStatus = '未首触'
    if (latestInvitation) {
      if (!latestInvitation.replied) fallbackStatus = '已邀约'
      else if (latestInvitation.reply_result.includes('同意')) fallbackStatus = '待寄出'
      else if (latestInvitation.reply_result.includes('拒绝')) fallbackStatus = '拒绝合作'
      else fallbackStatus = '已邀约'
    }

    await onUpdate({
      ...kol,
      sample_product: '',
      sample_date: null,
      tracking_number: '',
      shipping_details: '',
      status: fallbackStatus,
      updated_at: new Date().toISOString(),
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
      })
      await syncKolSnapshot(saved, '已签收')
      await onShipmentsChange()
      showToast('已确认签收')
    } catch {
      showToast('更新失败')
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
        await syncDerivedKolStatus(next)
        await onInvitationsChange()
        showToast('邀约已更新')
        return
      }

      const inv = await createInvitation(data)
      const updated = [inv, ...invitations]
      setInvitations(updated)
      setShowInvModal(false)
      await syncDerivedKolStatus(updated)
      if (INVITATION_ENTRY_STATUSES.includes(kol.status)) pushStatus('已邀约')
      await onInvitationsChange()
      showToast('邀约已添加')
    } catch { showToast(editingInvitation ? '更新失败' : '添加失败') }
  }

  const handleReplyUpdate = async (inv: Invitation, result: string) => {
    try {
      const saved = await updateInvitation(inv.id, { replied: true, reply_result: result })
      setInvitations(prev => prev.map(i => i.id === inv.id ? saved : i))
      if (result === '同意合作') {
        const existingShipments = await getShipmentsByKOL(kol.id)
        const hasSamePendingShipment = existingShipments.some(s =>
          s.product === inv.product && s.status === '待寄出' && !s.tracking_number?.trim()
        )
        if (!hasSamePendingShipment) {
          const shipment = await createShipment({
            kol_id: kol.id,
            product: inv.product,
            sample_date: null,
            tracking_number: '',
            shipping_details: kol.shipping_details || '',
            status: '待寄出',
            notes: '邀约同意后自动生成',
            delivered_at: null,
            progress_status: '待制作',
            progress_notes: '',
            expected_publish_date: null,
            completed_at: null,
          })
          await syncKolSnapshot(shipment, '待寄出')
          await onShipmentsChange()
        } else {
          pushStatus('待寄出')
        }
      } else if (result === '拒绝合作') pushStatus('拒绝合作')
      else if (result === '未回复') pushStatus('已邀约')
      showToast('回复已更新')
    } catch {
      showToast('更新失败')
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
    } catch {}
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
    } catch { showToast(editingCollaboration ? '更新失败' : '添加失败') }
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
        '已签收': 'bg-teal-100 text-teal-700',
      '待制作': 'bg-amber-100 text-amber-700', '制作中': 'bg-sky-100 text-sky-700',
      '待发布': 'bg-cyan-100 text-cyan-700', '进度异常': 'bg-red-100 text-red-700',
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
              {collaborationCount > 0 && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/25">合作过 {collaborationCount} 次</span>}
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
                  <InlineEdit label="核心平台" value={kol.platform} onSave={v => save('platform', v)} type="select" options={['YouTube','TikTok','X','Blog','Forum','Instagram']} />
                  <InlineEdit label="主页链接" value={kol.homepage_url} onSave={v => save('homepage_url', v)} />
                  <InlineEdit label="粉丝量级" value={kol.followers} onSave={v => save('followers', v)} />
                  <InlineEdit label="国家/地区" value={kol.country} onSave={v => save('country', v)} />
                  <InlineEdit label="领域标签" value={kol.tags.join(', ')} onSave={saveTags} />
                </FieldGrid>
              </SectionCard>

              <SectionCard icon="📦" title="寄样与进度" accent="border-l-orange-500" bg="bg-white"
                action={<button onClick={() => { setEditingShipment(null); setShowShipmentModal(true) }} className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium">+ 新增寄样</button>}
              >
                {kolShipments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/50 px-4 py-6 text-center">
                    <p className="text-sm font-medium text-orange-700">暂无寄样记录</p>
                    <p className="text-xs text-orange-500 mt-1">点击右上角新增，第二次补寄也会单独成一条记录。</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                    {kolShipments.map(shipment => (
                      <div key={shipment.id} className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">📦 {shipment.product}</span>
                              <span className={statusLabel(shipment.status)}>{shipment.status}</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">创建于 {shipment.created_at?.slice(0, 10)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {shipment.status === '运输中' && (
                              <button onClick={() => handleConfirmDelivered(shipment)} className="text-[11px] px-2.5 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600">确认签收</button>
                            )}
                            <button onClick={() => { setEditingShipment(shipment); setShowShipmentModal(true) }} className="text-[11px] text-orange-600 hover:text-orange-800">编辑</button>
                            <button onClick={() => handleDeleteShipment(shipment)} className="text-[11px] text-red-400 hover:text-red-600">删除</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div className="bg-white/70 rounded-lg px-2 py-1.5">📅 寄样日期：{shipment.sample_date || '-'}</div>
                          <div className="bg-white/70 rounded-lg px-2 py-1.5">📮 快递单号：{shipment.tracking_number || '-'}</div>
                          <div className="bg-white/70 rounded-lg px-2 py-1.5">⏱️ 送达日期：{shipment.delivered_at || '-'}</div>
                          <div className="bg-white/70 rounded-lg px-2 py-1.5">🎬 内容进度：{shipment.completed_at ? '已完成' : shipment.progress_status || '-'}</div>
                        </div>
                        {shipment.shipping_details && <p className="mt-2 text-xs text-gray-500 bg-white/70 rounded-lg px-2 py-1.5">📍 {shipment.shipping_details}</p>}
                        {shipment.notes && <p className="mt-2 text-[11px] text-gray-400 border-t border-orange-100 pt-2">物流备注：{shipment.notes}</p>}
                        {shipment.progress_notes && <p className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5">进度备注：{shipment.progress_notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2 text-[11px] text-orange-700">
                  新规则：每次寄产品都是一条寄样记录；邀约同意后进入待寄出，填快递单号进入运输中，确认签收后进入已签收。
                </div>
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
                        <span className="text-gray-600 text-xs flex-1 truncate">{inv.notes || '-'}</span>
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
                ) : collaborations.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">暂无合作记录</p>
                ) : (
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {collaborations.map(col => (
                      <div key={col.id} className="p-3 bg-teal-50/50 rounded-lg border border-teal-100 hover:border-teal-200 transition-colors group">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold text-teal-700 text-sm">{col.product}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{col.publish_date || col.cooperation_date}</span>
                            <button onClick={() => { setEditingCollaboration(col); setShowColModal(true) }} className="opacity-0 group-hover:opacity-100 text-xs text-teal-600 hover:text-teal-800 transition-all">编辑</button>
                            <button onClick={() => handleDeleteCollaboration(col.id)} className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition-all">删除</button>
                          </div>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-600 mb-1 flex-wrap">
                          {col.views ? <span className="bg-teal-100 px-1.5 py-0.5 rounded text-[10px]">▶ {fmt(col.views)}</span> : null}
                          {col.comments ? <span className="bg-teal-100 px-1.5 py-0.5 rounded text-[10px]">💬 {fmt(col.comments)}</span> : null}
                          {col.likes ? <span className="bg-teal-100 px-1.5 py-0.5 rounded text-[10px]">❤️ {fmt(col.likes)}</span> : null}
                          {col.fee ? <span className="bg-teal-100 px-1.5 py-0.5 rounded text-[10px]">💰 {col.fee}</span> : null}
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
