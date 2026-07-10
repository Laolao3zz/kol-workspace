import { useMemo, useState, useEffect } from 'react'
import { BarChart3, ChevronDown, ChevronRight, CheckCircle2, ExternalLink, Mail, Package, Pencil, Plus, Trash2, Truck, UserRound, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { KOL, Invitation, Collaboration, Shipment, Product, PLATFORMS } from '../types'
import { getInvitationsByKOL, createInvitation, deleteInvitation, updateInvitation } from '../services/invitationService'
import { getCollaborationsByKOL, createCollaboration, deleteCollaboration, ensureCompletionCollaboration, updateCollaboration } from '../services/collaborationService'
import { createShipment, updateShipment, deleteShipment, getShipmentsByKOL } from '../services/shipmentService'
import { countCompletedCollaborations, deriveKolStatus, hasPublishReadyCollaborationSignal, hasRealCollaborationSignal } from '../utils/kolStatus'
import InlineEdit from './InlineEdit'
import MailPanel from './MailPanel'
import AddInvitationModal, { InvitationFormData } from './AddInvitationModal'
import AddCollaborationModal, { CollaborationFormData } from './AddCollaborationModal'
import AddShipmentModal, { ShipmentFormData } from './AddShipmentModal'
import EditProgressModal, { ProgressFormData } from './EditProgressModal'
import { collectProductOptions } from '../utils/productOptions'
import { mergeOpportunityProducts } from '../utils/productMatching'
import {
  AUTO_CREATED_SHIPMENT_NOTE,
  findStaleAutoCreatedPendingShipments,
  isInvitationApprovedForShipment,
} from '../utils/invitationWorkflow'
import { getContentShapeMetricLabels, getKolContentShape } from '../utils/contentShape'
import { buildProductOpportunitySummary, type OpportunityStatus } from '../utils/workspaceViews'

interface Props {
  kol: KOL
  shipments: Shipment[]
  collaborationCount: number
  products: Product[]
  productOptions: string[]
  onClose: () => void
  onUpdate: (id: string, updates: Partial<KOL>) => Promise<KOL> | KOL
  onInvitationsChange: () => Promise<void> | void
  onCollaborationsChange: () => Promise<void> | void
  onShipmentsChange: () => Promise<void> | void
}

const opportunityOrder: OpportunityStatus[] = ['未触达', '待回复', '已同意', '寄样中', '内容中', '已完成', '已拒绝', '不推进']

const opportunityTone: Record<OpportunityStatus, string> = {
  未触达: 'bg-gray-100 text-gray-600',
  待回复: 'bg-amber-50 text-amber-700',
  已同意: 'bg-blue-50 text-blue-700',
  已拒绝: 'bg-red-50 text-red-700',
  不推进: 'bg-slate-100 text-slate-600',
  寄样中: 'bg-cyan-50 text-cyan-700',
  内容中: 'bg-rose-50 text-rose-700',
  已完成: 'bg-emerald-50 text-emerald-700',
}

const opportunityHint = (status: OpportunityStatus) => {
  const map: Record<OpportunityStatus, string> = {
    未触达: '尚未触达该产品，可发起新邀约',
    待回复: '已触达，等待回复或需要跟进',
    已同意: '已同意合作，下一步安排寄样',
    寄样中: '样品流转中，等待签收',
    内容中: '样品已签收，进入内容跟进',
    已完成: '该产品已完成，可作为复合作参考',
    已拒绝: '博主已拒绝该产品',
    不推进: '我方已判定该产品不推进',
  }
  return map[status]
}

export default function KolDrawer({ kol, shipments, products, productOptions, onClose, onUpdate, onInvitationsChange, onCollaborationsChange, onShipmentsChange }: Props) {
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

  const allKolShipments = shipments.filter(s => s.kol_id === kol.id)
  const kolShipments = allKolShipments.filter(s => !s.archived_at)
  const completedCollaborations = collaborations.filter(hasRealCollaborationSignal)
  const publishReadyCollaborations = collaborations.filter(hasPublishReadyCollaborationSignal)
  const completedCollaborationCount = countCompletedCollaborations(collaborations)
  const contentShape = getKolContentShape(kol)
  const metricLabels = getContentShapeMetricLabels(contentShape)
  const drawerProductOptions = collectProductOptions({
    products: productOptions,
    kols: [kol],
    invitations,
    shipments: allKolShipments,
    collaborations,
  })
  const drawerOpportunityProducts = useMemo(
    () => mergeOpportunityProducts(products, drawerProductOptions),
    [products, drawerProductOptions]
  )
  const productOpportunities = useMemo(() => {
    if (drawerOpportunityProducts.length === 0) return []
    return buildProductOpportunitySummary({
      products: drawerOpportunityProducts,
      kols: [kol],
      invitations: { [kol.id]: invitations },
      shipments: allKolShipments,
      collaborationsByKol: { [kol.id]: collaborations },
    })
      .map(summary => ({
        product: summary.product,
        status: summary.rows[0]?.status || '未触达',
      }))
      .sort((a, b) => opportunityOrder.indexOf(a.status) - opportunityOrder.indexOf(b.status))
  }, [allKolShipments, collaborations, drawerOpportunityProducts, invitations, kol])

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
  const INVITATION_ENTRY_STATUSES = ['未首触', '未回复', '拒绝合作', '我方拒绝', '沟通中', '']

  const nextKolStatus = (shipment: ShipmentFormData | Shipment) => {
    if ('completed_at' in shipment && shipment.completed_at) return '合作完成'
    if ('progress_status' in shipment && shipment.progress_status === '已完成') return '合作完成'
    if (shipment.status === '已签收') return shipment.progress_status === '暂停/异常' ? '异常' : '内容跟进'
    if (shipment.tracking_number?.trim() || shipment.status === '运输中') return '运输中'
    return '待寄出'
  }

  const syncKolStatus = async (status: string) => {
    await onUpdate(kol.id, { status })
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

  const ensureShipmentForInvitation = async (invitation: Invitation) => {
    if (!isInvitationApprovedForShipment(invitation)) {
      console.log('⏭️ 跳过自动创建寄样记录:', {
        reply_result: invitation.reply_result,
        decision: invitation.decision,
        需要: '同意合作 + 继续推进'
      })
      return false
    }

    const existingShipments = await getShipmentsByKOL(kol.id)
    const hasSamePendingShipment = existingShipments.some(s =>
      s.product === invitation.product && s.status === '待寄出' && !s.tracking_number?.trim()
    )

    if (hasSamePendingShipment) {
      console.log('⏭️ 已存在相同产品的待寄出记录，跳过创建')
      return false
    }

    console.log('✨ 自动创建寄样记录:', { product: invitation.product })

    try {
      await createShipment({
        kol_id: kol.id,
        product: invitation.product,
        sample_date: null,
        tracking_number: '',
        shipping_details: kol.shipping_details || '',
        status: '待寄出',
        notes: AUTO_CREATED_SHIPMENT_NOTE,
        delivered_at: null,
        progress_status: '待制作',
        progress_notes: '',
        expected_publish_date: null,
        completed_at: null,
        archived_at: null,
      })
      console.log('✅ 寄样记录创建成功')
      return true
    } catch (error) {
      console.error('❌ 寄样记录创建失败:', error)
      throw error
    }
  }

  const syncInvitationWorkflow = async (savedInvitation: Invitation, nextInvitations: Invitation[]) => {
    console.log('🔄 syncInvitationWorkflow 开始', {
      invitation: savedInvitation,
      reply_result: savedInvitation.reply_result,
      decision: savedInvitation.decision,
      shouldCreate: isInvitationApprovedForShipment(savedInvitation)
    })

    const createdShipment = await ensureShipmentForInvitation(savedInvitation)
    console.log('📦 寄样记录创建结果:', createdShipment ? '已创建' : '未创建')

    const workflowShipments = createdShipment ? await getShipmentsByKOL(kol.id) : kolShipments
    const staleAutoShipments = findStaleAutoCreatedPendingShipments(workflowShipments, nextInvitations)
    if (staleAutoShipments.length > 0) {
      await Promise.all(staleAutoShipments.map(shipment => deleteShipment(shipment.id)))
      console.log('🧹 已清理失效的自动待寄出记录:', staleAutoShipments.map(shipment => shipment.id))
    }

    const shipmentsChanged = createdShipment || staleAutoShipments.length > 0
    const nextShipments = shipmentsChanged ? await getShipmentsByKOL(kol.id) : workflowShipments
    if (shipmentsChanged) {
      await onShipmentsChange()
    }

    const oldStatus = kol.status
    await syncDerivedKolStatus(nextInvitations, nextShipments)
    console.log('✅ KOL 状态更新:', { 旧状态: oldStatus, 新状态: deriveKolStatus(kol, nextInvitations, nextShipments, collaborations) })
  }

  const handleSaveShipment = async (data: ShipmentFormData) => {
    console.log('💾 保存寄样记录:', { data, isEditing: !!editingShipment })

    try {
      // 前端验证
      if (!data.product?.trim()) {
        showToast('❌ 产品名称不能为空')
        return
      }

      if (data.status === '运输中' && !data.tracking_number?.trim()) {
        showToast('❌ 运输中状态必须填写快递单号')
        return
      }

      if (data.status === '已签收' && !data.delivered_at) {
        showToast('❌ 已签收状态必须填写签收日期')
        return
      }

      const payload = {
        ...data,
        status: data.status === '已签收' ? '已签收' : shipmentStatus(data.tracking_number),
        delivered_at: data.status === '已签收' ? data.delivered_at : null,
        expected_publish_date: data.expected_publish_date ?? editingShipment?.expected_publish_date ?? null,
        archived_at: editingShipment?.archived_at ?? null,
      }

      console.log('📤 提交数据:', payload)

      const saved = editingShipment
        ? await updateShipment(editingShipment.id, payload)
        : await createShipment(payload)

      console.log('✅ 寄样记录保存成功:', saved)

      await syncKolStatus(nextKolStatus(saved))
      await onShipmentsChange()
      setShowShipmentModal(false)
      setEditingShipment(null)
      showToast(editingShipment ? '寄样已更新' : '寄样已新增')
    } catch (err) {
      console.error('❌ 寄样保存失败:', err)
      const errorMsg = err instanceof Error ? err.message : '寄样保存失败'
      showToast(`❌ ${errorMsg}`)
    }
  }

  const resetKolAfterShipmentDelete = async (deletedShipmentId: string) => {
    const remaining = allKolShipments.filter(s => s.id !== deletedShipmentId && !s.archived_at)
    const latest = remaining.reduce<Shipment | null>((current, shipment) => {
      if (!current) return shipment
      const shipmentTime = shipment.sample_date || shipment.delivered_at || shipment.created_at || ''
      const currentTime = current.sample_date || current.delivered_at || current.created_at || ''
      return shipmentTime > currentTime ? shipment : current
    }, null)

    if (latest) {
      await syncKolStatus(nextKolStatus(latest))
      return
    }

    const fallbackStatus = deriveKolStatus(kol, invitations, [], collaborations)

    await syncKolStatus(fallbackStatus)
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
      await syncKolStatus(nextKolStatus(saved))
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
      if (saved.progress_status === '已完成' || saved.completed_at) {
        await ensureCompletionCollaboration(saved)
        const nextCollaborations = await getCollaborationsByKOL(kol.id)
        setCollaborations(nextCollaborations)
        await onCollaborationsChange()
      }
      await syncKolStatus(nextKolStatus(saved))
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

  const handleDeleteInvitation = async (id: string) => {
    if (!confirm('删除该邀约记录？')) return
    try {
      await deleteInvitation(id)
      const next = invitations.filter(i => i.id !== id)
      setInvitations(next)

      // 重新获取最新的 shipments 数据，并清理已失去有效同意邀约的自动待寄出记录
      const latestShipments = await getShipmentsByKOL(kol.id)
      const staleAutoShipments = findStaleAutoCreatedPendingShipments(latestShipments, next)
      if (staleAutoShipments.length > 0) {
        await Promise.all(staleAutoShipments.map(shipment => deleteShipment(shipment.id)))
      }
      const nextShipments = staleAutoShipments.length > 0 ? await getShipmentsByKOL(kol.id) : latestShipments

      // 重新计算并更新 KOL 状态
      await syncDerivedKolStatus(next, nextShipments, collaborations)

      // 通知父组件刷新邀约数据
      if (staleAutoShipments.length > 0) {
        await onShipmentsChange()
      }
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
      '我方拒绝': 'bg-red-100 text-red-700',
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
      <div className="relative ml-auto flex w-[92%] max-w-[1320px] flex-col overflow-hidden bg-[#F5F5F7] shadow-2xl">
        <div className="shrink-0 border-b border-black/[0.06] bg-white px-8 py-5">
          <div className="flex items-center gap-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#1D1D1F] text-sm font-extrabold text-white">
            {kol.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="truncate text-xl font-extrabold text-[#1D1D1F]">{kol.name}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${contentShape === '网站' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{contentShape}</span>
                <span className={statusLabel(kol.status)}>当前流程：{kol.status || '-'}</span>
                {completedCollaborationCount > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">合作过 {completedCollaborationCount} 次</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#86868B]">
                <span>{kol.platform || '-'}</span>
                <span>·</span>
                <span>{kol.followers || '-'}</span>
                <span>·</span>
                <span>{kol.country || '-'}</span>
                {kol.homepage_url && (
                  <>
                    <span>·</span>
                    <a href={kol.homepage_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#0066FF] hover:underline">
                      主页 <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            </div>
            <button onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-black/[0.08] bg-white text-[#86868B] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]" title="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-5">
              <SectionCard icon={UserRound} title="基础身份">
                <div className="mb-4 grid grid-cols-2 gap-2 text-xs font-semibold text-[#6E6E73] md:grid-cols-4">
                  <DetailPill label="内容形态" value={contentShape} />
                  <DetailPill label="当前流程" value={kol.status || '-'} />
                  <DetailPill label="合作次数" value={`${completedCollaborationCount} 次`} />
                  <DetailPill label="产品机会" value={`${productOpportunities.length} 个`} />
                </div>
                <FieldGrid>
                  <InlineEdit label="博主名称" value={kol.name} onSave={v => save('name', v)} />
                  <InlineEdit label="联系邮箱" value={kol.email} onSave={v => save('email', v)} />
                  <InlineEdit label="核心平台" value={kol.platform} onSave={v => save('platform', v)} type="select" options={PLATFORMS} />
                  <InlineEdit label="主页链接" value={kol.homepage_url} onSave={v => save('homepage_url', v)} />
                  <InlineEdit label="粉丝量级" value={kol.followers} onSave={v => save('followers', v)} />
                  <InlineEdit label="国家/地区" value={kol.country} onSave={v => save('country', v)} />
                  <InlineEdit label="领域标签" value={kol.tags.join(', ')} onSave={saveTags} />
                  <InlineEdit label="KOL 备注" value={kol.notes || ''} onSave={v => save('notes', v)} type="textarea" />
                </FieldGrid>
              </SectionCard>

              <SectionCard icon={Package} title="产品机会"
                action={<HeaderButton onClick={() => { setEditingInvitation(null); setShowInvModal(true) }} icon={Plus}>发起邀约</HeaderButton>}
              >
                {productOpportunities.length === 0 ? (
                  <div className="rounded-[14px] border border-dashed border-black/[0.08] bg-[#F5F5F7] px-4 py-6 text-center">
                    <p className="text-sm font-bold text-[#1D1D1F]">暂无产品机会</p>
                    <p className="mt-1 text-xs font-medium text-[#86868B]">新增产品邀约、寄样或合作记录后会自动汇总。</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {productOpportunities.map(item => (
                      <div key={item.product} className="rounded-[12px] border border-black/[0.06] bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-extrabold text-[#1D1D1F]" title={item.product}>{item.product}</div>
                            <div className="mt-1 text-[11px] font-medium text-[#86868B]">{opportunityHint(item.status)}</div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${opportunityTone[item.status]}`}>{item.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard icon={Package} title="当前合作链路"
                action={<HeaderButton onClick={() => { setEditingShipment(null); setShowShipmentModal(true) }} icon={Plus}>新增寄样</HeaderButton>}
              >
                {kolShipments.length === 0 ? (
                  <div className="space-y-3">
                    <div className="rounded-[14px] border border-dashed border-black/[0.08] bg-[#F5F5F7] px-4 py-6 text-center">
                      <p className="text-sm font-bold text-[#1D1D1F]">暂无进行中的合作链路</p>
                      <p className="mt-1 text-xs font-medium text-[#86868B]">同意合作后会自动生成待寄样记录。</p>
                    </div>
                    {latestInvitation && (
                      <div className="rounded-[14px] border border-black/[0.06] bg-white p-3 text-xs font-semibold text-[#6E6E73]">
                        最近邀约：{latestInvitation.product} · {latestInvitation.replied ? latestInvitation.reply_result : '未回复'} · {latestInvitation.invited_at}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
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
                        <div key={shipment.id} className="rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-[#1D1D1F]">{shipment.product}</span>
                                <span className={statusLabel(kol.status)}>{kol.status}</span>
                                <span className={statusLabel(contentLabel)}>{contentLabel}</span>
                              </div>
                              <p className="mt-1 text-[11px] font-semibold text-[#86868B]">创建于 {shipment.created_at?.slice(0, 10)} · 物流 {shipment.status || '-'}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                              {shipment.status === '运输中' && (
                                <DrawerAction onClick={() => handleConfirmDelivered(shipment)} icon={CheckCircle2} tone="primary">确认签收</DrawerAction>
                              )}
                              <DrawerAction onClick={() => { setEditingShipment(shipment); setShowShipmentModal(true) }} icon={Truck}>物流</DrawerAction>
                              <DrawerAction onClick={() => setEditingProgress(shipment)} icon={Pencil}>进度</DrawerAction>
                              <DrawerAction onClick={() => handleDeleteShipment(shipment)} icon={Trash2} tone="danger">删除</DrawerAction>
                            </div>
                          </div>

                          <div className="mb-4 grid grid-cols-5 gap-2">
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

                          <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-[#6E6E73]">
                            <DetailPill label="寄样日期" value={shipment.sample_date || '-'} />
                            <DetailPill label="快递单号" value={shipment.tracking_number || '-'} />
                            <DetailPill label="收件信息" value={shipment.shipping_details || '-'} />
                            <DetailPill label="内容进度" value={contentLabel} />
                            <DetailPill label="完成日期" value={shipment.completed_at || '-'} />
                          </div>
                          {shipment.notes && <p className="mt-2 border-t border-black/[0.06] pt-2 text-[11px] font-medium text-[#6E6E73]">物流备注：{shipment.notes}</p>}
                          {shipment.progress_notes && <p className="mt-2 rounded-[10px] border border-rose-100 bg-rose-50 px-2 py-1.5 text-[11px] font-semibold text-rose-700">进度备注：{shipment.progress_notes}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="space-y-5">
              <SectionCard icon={Mail} title="邀约记录"
                action={<HeaderButton onClick={() => { setEditingInvitation(null); setShowInvModal(true) }} icon={Plus}>发起邀约</HeaderButton>}
              >
                {loadingSub ? (
                  <div className="space-y-2">{ [1,2].map(i => <div key={i} className="h-12 rounded-[12px] bg-[#F5F5F7] animate-pulse" />) }</div>
                ) : invitations.length === 0 ? (
                  <p className="py-4 text-center text-xs font-semibold text-[#86868B]">暂无邀约</p>
                ) : (
                  <div className="max-h-[320px] space-y-2 overflow-y-auto">
                    {invitations.map(inv => (
                      <div key={inv.id} className="group flex items-center gap-3 rounded-[12px] border border-black/[0.06] bg-white p-3 transition hover:bg-[#F5F5F7]">
                        <div className="h-2 w-2 shrink-0 rounded-full bg-[#0066FF]" />
                        <span className="w-20 shrink-0 text-xs font-semibold text-[#86868B]">{inv.invited_at}</span>
                        <span className="w-16 shrink-0 text-xs font-extrabold text-[#1D1D1F]">{inv.product}</span>
                        <span className="flex-1 truncate text-xs font-semibold text-[#6E6E73]">
                          {inv.quoted_fee ? `报价 ${inv.quoted_fee}` : inv.notes || '-'}
                          {inv.decision === '我方拒绝' ? ' · 我方不同意' : ''}
                          {inv.reply_result?.includes('拒绝') ? ' · 博主不同意' : ''}
                        </span>
                        {invReplyBadge(inv)}
                        <button onClick={() => { setEditingInvitation(inv); setShowInvModal(true) }} className="shrink-0 text-[#AEAEB2] opacity-0 transition hover:text-[#0066FF] group-hover:opacity-100" title="编辑">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDeleteInvitation(inv.id)} className="shrink-0 text-[#AEAEB2] opacity-0 transition hover:text-red-600 group-hover:opacity-100" title="删除">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard icon={BarChart3} title="合作历史"
                action={<HeaderButton onClick={() => { setEditingCollaboration(null); setShowColModal(true) }} icon={Plus}>添加合作</HeaderButton>}
              >
                {loadingSub ? (
                  <div className="space-y-2">{ [1,2].map(i => <div key={i} className="h-16 rounded-[12px] bg-[#F5F5F7] animate-pulse" />) }</div>
                ) : completedCollaborations.length === 0 ? (
                  <p className="py-4 text-center text-xs font-semibold text-[#86868B]">暂无已完成合作记录</p>
                ) : (
                  <div className="max-h-[320px] space-y-2 overflow-y-auto">
                    {publishReadyCollaborations.length === 0 && completedCollaborations.some(col => col.notes?.includes('系统归档')) && (
                      <div className="rounded-[12px] border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
                        已有系统归档记录，但缺少发布日期、作品链接或{metricLabels.viewsInput}。请在进度看板完成归档后补填作品信息，补齐后会出现在合作历史列表。
                      </div>
                    )}
                    {publishReadyCollaborations.map(col => (
                      <div key={col.id} className="group rounded-[12px] border border-black/[0.06] bg-white p-3 transition hover:bg-[#F5F5F7]">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-extrabold text-[#1D1D1F]">{col.product}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#86868B]">{col.publish_date}</span>
                            <button onClick={() => { setEditingCollaboration(col); setShowColModal(true) }} className="text-[#AEAEB2] opacity-0 transition hover:text-[#0066FF] group-hover:opacity-100" title="编辑">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeleteCollaboration(col.id)} className="text-[#AEAEB2] opacity-0 transition hover:text-red-600 group-hover:opacity-100" title="删除">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mb-2 flex flex-wrap gap-2 text-sm text-[#6E6E73]">
                          {col.views !== null && col.views !== undefined ? <span className="rounded-full bg-[#F5F5F7] px-2.5 py-1 text-xs font-bold">{metricLabels.views} {fmt(col.views)}</span> : null}
                          {col.comments !== null && col.comments !== undefined ? <span className="rounded-full bg-[#F5F5F7] px-2.5 py-1 text-xs font-bold">{metricLabels.comments} {fmt(col.comments)}</span> : null}
                          {col.likes !== null && col.likes !== undefined ? <span className="rounded-full bg-[#F5F5F7] px-2.5 py-1 text-xs font-bold">{metricLabels.likes} {fmt(col.likes)}</span> : null}
                          {col.fee ? <span className="rounded-full bg-[#F5F5F7] px-2.5 py-1 text-xs font-bold">{col.fee}</span> : null}
                        </div>
                        {col.work_url && <a href={col.work_url} target="_blank" rel="noreferrer" className="block truncate text-[11px] font-semibold text-[#0066FF] hover:underline">{col.work_url}</a>}
                        {col.notes && <p className="mt-2 border-t border-black/[0.06] pt-2 text-[11px] font-medium text-[#86868B]">{col.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <div>
                <button onClick={() => setShowMail(!showMail)} className="flex items-center gap-2 rounded-[12px] px-2 py-2 text-sm font-bold text-[#6E6E73] transition hover:bg-white hover:text-[#1D1D1F]">
                  {showMail ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Mail className="h-4 w-4" /> 邮件往来
                </button>
                {showMail && <div className="mt-3 max-h-[400px] overflow-hidden rounded-[16px] border border-black/[0.06] bg-white p-4 shadow-sm"><MailPanel kolEmail={kol.email} kolId={kol.id} /></div>}
              </div>
            </div>
          </div>
        </div>

        {toast && <div className="fixed bottom-6 right-6 z-[60] rounded-[12px] bg-[#1D1D1F] px-5 py-2.5 text-sm font-bold text-white shadow-lg">{toast}</div>}
      </div>

      {showInvModal && <AddInvitationModal kolId={kol.id} invitation={editingInvitation} productOptions={drawerProductOptions} onClose={() => { setShowInvModal(false); setEditingInvitation(null) }} onSubmit={handleAddInvitation} />}
      {showColModal && <AddCollaborationModal kolId={kol.id} collaboration={editingCollaboration} productOptions={drawerProductOptions} contentShape={contentShape} onClose={() => { setShowColModal(false); setEditingCollaboration(null) }} onSubmit={handleAddCollaboration} />}
      {showShipmentModal && <AddShipmentModal kolId={kol.id} shipment={editingShipment} productOptions={drawerProductOptions} onClose={() => { setShowShipmentModal(false); setEditingShipment(null) }} onSubmit={handleSaveShipment} />}
      {editingProgress && <EditProgressModal shipment={editingProgress} onClose={() => setEditingProgress(null)} onSubmit={handleSaveProgress} />}
    </div>
  )
}

function SectionCard({ icon: Icon, title, action, children }: {
  icon: LucideIcon; title: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#1D1D1F]">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#F5F5F7] text-[#1D1D1F]"><Icon className="h-4 w-4" /></span>
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-5 gap-y-3 md:grid-cols-2">{children}</div>
}

function HeaderButton({ icon: Icon, children, onClick }: { icon: LucideIcon; children: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#1D1D1F] px-3 text-xs font-bold text-white transition active:scale-95">
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}

function DrawerAction({ icon: Icon, children, onClick, tone = 'neutral' }: { icon: LucideIcon; children: string; onClick: () => void; tone?: 'neutral' | 'primary' | 'danger' }) {
  const className = tone === 'primary'
    ? 'bg-[#0066FF] text-white'
    : tone === 'danger'
      ? 'bg-red-50 text-red-600'
      : 'bg-[#F5F5F7] text-[#1D1D1F]'
  return (
    <button onClick={onClick} className={`inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2.5 text-[11px] font-bold transition hover:opacity-85 ${className}`}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  )
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-[#F5F5F7] px-2 py-1.5">
      <span className="text-[#AEAEB2]">{label}：</span>
      <span>{value}</span>
    </div>
  )
}
