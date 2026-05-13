import { useState, useEffect } from 'react'
import { KOL, Invitation, Collaboration } from '../types'
import { getInvitationsByKOL, createInvitation, deleteInvitation, updateInvitation } from '../services/invitationService'
import { getCollaborationsByKOL, createCollaboration, deleteCollaboration } from '../services/collaborationService'
import InlineEdit from './InlineEdit'
import MailPanel from './MailPanel'
import AddInvitationModal, { InvitationFormData } from './AddInvitationModal'
import AddCollaborationModal, { CollaborationFormData } from './AddCollaborationModal'

interface Props {
  kol: KOL
  onClose: () => void
  onUpdate: (kol: KOL) => void
}

export default function KolDrawer({ kol, onClose, onUpdate }: Props) {
  const [toast, setToast] = useState('')
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [collaborations, setCollaborations] = useState<Collaboration[]>([])
  const [loadingSub, setLoadingSub] = useState(true)
  const [showInvModal, setShowInvModal] = useState(false)
  const [showColModal, setShowColModal] = useState(false)
  const [showMail, setShowMail] = useState(false)

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

  const pushStatus = (newStatus: string) => {
    const updated = { ...kol, status: newStatus, updated_at: new Date().toISOString() }
    onUpdate(updated)
  }

  const save = (field: keyof KOL, value: string | string[]) => {
    const updated = { ...kol, [field]: value, updated_at: new Date().toISOString() }
    onUpdate(updated)
    setToast('已保存')
    setTimeout(() => setToast(''), 2200)
  }

  const handleAddInvitation = async (data: InvitationFormData) => {
    try {
      const inv = await createInvitation(data)
      const updated = [inv, ...invitations]
      setInvitations(updated)
      setShowInvModal(false)
      // Push status to "已邀约"
      pushStatus('已邀约')
      setToast('邀约已添加')
      setTimeout(() => setToast(''), 2200)
    } catch { setToast('添加失败'); setTimeout(() => setToast(''), 2200) }
  }

  const handleReplyUpdate = async (inv: Invitation, result: string) => {
    try {
      const saved = await updateInvitation(inv.id, { replied: true, reply_result: result })
      setInvitations(prev => prev.map(i => i.id === inv.id ? saved : i))
      // Push KOL status based on reply
      if (result === '同意合作') pushStatus('沟通中')
      else if (result === '拒绝合作' || result === '未回复') {
        pushStatus(result === '拒绝合作' ? '拒绝合作' : '未回复')
      }
      setToast('回复已更新')
    } catch {
      setToast('更新失败')
    }
    setTimeout(() => setToast(''), 2200)
  }

  const handleDeleteInvitation = async (id: string) => {
    if (!confirm('删除该邀约记录？')) return
    try {
      await deleteInvitation(id)
      setInvitations(prev => prev.filter(i => i.id !== id))
    } catch {}
  }

  const handleAddCollaboration = async (data: CollaborationFormData) => {
    try {
      const col = await createCollaboration(data)
      setCollaborations(prev => [col, ...prev])
      setShowColModal(false)
      setToast('合作已添加')
      setTimeout(() => setToast(''), 2200)
    } catch { setToast('添加失败'); setTimeout(() => setToast(''), 2200) }
  }

  const handleDeleteCollaboration = async (id: string) => {
    if (!confirm('删除该合作记录？')) return
    try {
      await deleteCollaboration(id)
      setCollaborations(prev => prev.filter(c => c.id !== id))
    } catch {}
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
      '沟通中': 'bg-yellow-100 text-yellow-700', '待寄出': 'bg-orange-100 text-orange-700',
      '运输中': 'bg-blue-100 text-blue-700', '已签收': 'bg-teal-100 text-teal-700',
      '合作完成': 'bg-green-100 text-green-700',
      '拒绝合作': 'bg-red-100 text-red-700', '未回复': 'bg-yellow-100 text-yellow-700',
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
        {/* Header */}
        <div className="shrink-0 px-8 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white flex items-center gap-5">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-lg shadow-inner">
            {kol.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">{kol.name}</h2>
              <span className={statusLabel(kol.status)}>{kol.status}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-purple-200 text-sm">
              <span>{kol.platform}</span><span className="opacity-40">|</span>
              <span>{kol.followers}</span><span className="opacity-40">|</span>
              <span>{kol.country}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors text-lg">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6">
              <SectionCard icon="👤" title="基础身份" accent="border-l-indigo-500" bg="bg-white">
                <FieldGrid>
                  <InlineEdit label="博主名称" value={kol.name} onSave={v => save('name', v)} />
                  <InlineEdit label="联系邮箱" value={kol.email} onSave={v => save('email', v)} />
                  <InlineEdit label="核心平台" value={kol.platform} onSave={v => save('platform', v)} type="select" options={['YouTube','TikTok','X','Blog','Forum','Instagram']} />
                  <InlineEdit label="主页链接" value={kol.homepage_url} onSave={v => save('homepage_url', v)} />
                  <InlineEdit label="粉丝量级" value={kol.followers} onSave={v => save('followers', v)} />
                  <InlineEdit label="国家/地区" value={kol.country} onSave={v => save('country', v)} />
                  <InlineEdit label="领域标签" value={kol.tags.join(', ')} onSave={v => save('tags', v.split(',').map(s => s.trim()).filter(Boolean))} />
                </FieldGrid>
              </SectionCard>

              <SectionCard icon="📦" title="寄样与进度" accent="border-l-orange-500" bg="bg-white"
                action={<span className={statusLabel(kol.status)}>{kol.status}</span>}
              >
                <div className="space-y-3">
                  <InlineEdit label="寄送产品" value={kol.sample_product || ''} onSave={v => save('sample_product', v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <InlineEdit label="寄样日期" value={kol.sample_date || ''} onSave={v => save('sample_date', v)} type="date" />
                    <InlineEdit label="快递单号" value={kol.tracking_number} onSave={v => save('tracking_number', v)} />
                  </div>
                  <InlineEdit label="收件详情" value={kol.shipping_details} onSave={v => save('shipping_details', v)} type="textarea" />
                  <div className="mt-2 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2 text-[11px] text-orange-700">
                    {kol.status === '沟通中' && '下一步：填写「寄样日期」后，状态会自动变为「待寄出」。'}
                    {kol.status === '待寄出' && '下一步：填写「快递单号」后，状态会自动变为「运输中」。'}
                    {kol.status === '运输中' && '下一步：到「寄样看板」点击「确认签收」，状态会变为「已签收」。'}
                    {kol.status === '已签收' && '下一步：到「寄样看板」点击「合作完成」并填写合作数据，会进入合作历史。'}
                    {!['沟通中', '待寄出', '运输中', '已签收'].includes(kol.status) && '提示：当邀约回复标记为「同意合作」后进入沟通中，再填写寄样信息推进状态。'}
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              <SectionCard icon="📩" title="邀约记录" accent="border-l-purple-500" bg="bg-white"
                action={<button onClick={() => setShowInvModal(true)} className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium">+ 发起邀约</button>}
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
                          <select
                            value=""
                            onChange={e => { if (e.target.value) handleReplyUpdate(inv, e.target.value) }}
                            className="text-[10px] border border-purple-200 rounded px-1 py-0.5 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={e => e.stopPropagation()}
                          >
                            <option value="">标记</option>
                            <option value="同意合作">同意</option>
                            <option value="拒绝合作">拒绝</option>
                            <option value="未回复">未回复</option>
                          </select>
                        )}
                        <button onClick={() => handleDeleteInvitation(inv.id)} className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-600 transition-all shrink-0">删除</button>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard icon="📊" title="合作历史" accent="border-l-teal-500" bg="bg-white"
                action={<button onClick={() => setShowColModal(true)} className="text-xs px-3 py-1.5 bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors font-medium">+ 添加合作</button>}
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
                            <span className="text-[10px] text-gray-400">{col.publish_date || col.cooperation_date}</span>
                            <button onClick={() => handleDeleteCollaboration(col.id)} className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-600 transition-all">删除</button>
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

              {/* Mail toggle */}
              <div>
                <button onClick={() => setShowMail(!showMail)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  <span>{showMail ? '▼' : '▶'}</span> ✉️ 邮件往来
                </button>
                {showMail && (
                  <div className="mt-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm max-h-[400px] overflow-hidden">
                    <MailPanel kolEmail={kol.email} kolId={kol.id} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-6 right-6 z-[60] px-5 py-2.5 bg-gray-900 text-white text-sm rounded-xl shadow-lg">
            {toast}
          </div>
        )}
      </div>

      {showInvModal && <AddInvitationModal kolId={kol.id} onClose={() => setShowInvModal(false)} onSubmit={handleAddInvitation} />}
      {showColModal && <AddCollaborationModal kolId={kol.id} onClose={() => setShowColModal(false)} onSubmit={handleAddCollaboration} />}
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
