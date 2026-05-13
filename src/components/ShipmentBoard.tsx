import { useMemo, useState } from 'react'
import { KOL } from '../types'
import { createCollaboration } from '../services/collaborationService'
import AddCollaborationModal, { CollaborationFormData } from './AddCollaborationModal'

interface Props {
  kols: KOL[]
  onSelect: (kol: KOL) => void
  onUpdate: (kol: KOL) => void
}

export default function ShipmentBoard({ kols, onSelect, onUpdate }: Props) {
  const [completingKol, setCompletingKol] = useState<KOL | null>(null)

  const columns = useMemo(() => {
    const pending = kols.filter(k => k.status === '待寄出')
    const transit = kols.filter(k => k.status === '运输中')
    const delivered = kols.filter(k => k.status === '已签收')

    return [
      { key: 'pending', label: '待寄出', icon: '📋', color: 'border-l-amber-500', bg: 'bg-amber-50/30', kols: pending },
      { key: 'transit', label: '运输中', icon: '🚚', color: 'border-l-blue-500', bg: 'bg-blue-50/30', kols: transit },
      { key: 'delivered', label: '已签收', icon: '✅', color: 'border-l-emerald-500', bg: 'bg-emerald-50/30', kols: delivered },
    ]
  }, [kols])

  const pushStatus = (kol: KOL, status: string) => {
    onUpdate({ ...kol, status, updated_at: new Date().toISOString() })
  }

  const handleComplete = async (data: CollaborationFormData) => {
    if (!completingKol) return
    try {
      await createCollaboration({
        kol_id: completingKol.id,
        product: data.product,
        cooperation_date: data.cooperation_date,
        publish_date: data.publish_date || null,
        work_url: data.work_url || '',
        views: data.views || null,
        comments: data.comments || null,
        likes: data.likes || null,
        fee: data.fee || '',
        notes: data.notes || '',
      })
      pushStatus(completingKol, '合作完成')
    } catch {
      // fallback: still push status even if DB write fails
      pushStatus(completingKol, '合作完成')
    }
    setCompletingKol(null)
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      '待寄出': 'bg-orange-100 text-orange-700', '运输中': 'bg-blue-100 text-blue-700',
      '已签收': 'bg-teal-100 text-teal-700', '合作完成': 'bg-green-100 text-green-700',
    }
    return map[s] || 'bg-gray-100 text-gray-600'
  }

  return (
    <>
      <div className="flex gap-4 h-[calc(100vh-140px)]">
        {columns.map(col => (
          <div key={col.key} className={`flex-1 flex flex-col rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${col.bg} ${col.color} border-l-4`}>
            <div className="shrink-0 px-5 py-3 border-b border-gray-200/80 bg-white/60 backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <span>{col.icon}</span> {col.label}
                </h3>
                <span className="text-xs font-medium text-gray-400 bg-white px-2.5 py-0.5 rounded-full border border-gray-200">{col.kols.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {col.kols.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-2xl mb-2 opacity-30">{col.icon}</p>
                  <p className="text-xs text-gray-400">暂无</p>
                </div>
              ) : (
                col.kols.map(kol => (
                  <div key={kol.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
                    <div onClick={() => onSelect(kol)} className="cursor-pointer">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">{kol.name}</h4>
                          <p className="text-[11px] text-gray-500">{kol.platform} · {kol.followers}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${statusBadge(kol.status)}`}>
                          {kol.status}
                        </span>
                      </div>

                      {kol.sample_product && (
                        <div className="flex items-center gap-2 text-[11px] text-gray-600 mb-1">
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">📦 {kol.sample_product}</span>
                        </div>
                      )}
                      {kol.sample_date && (
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1">
                          <span>📅 {kol.sample_date}</span>
                        </div>
                      )}
                      {kol.tracking_number && (
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1">
                          <span>📮 {kol.tracking_number}</span>
                        </div>
                      )}
                      {kol.shipping_details && (
                        <div className="text-[11px] text-gray-400 mt-1 line-clamp-2">📍 {kol.shipping_details}</div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2">
                      {col.key === 'transit' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); pushStatus(kol, '已签收') }}
                          className="text-[11px] px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                        >
                          确认签收
                        </button>
                      )}
                      {col.key === 'delivered' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCompletingKol(kol) }}
                          className="text-[11px] px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium"
                        >
                          合作完成
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {completingKol && (
        <AddCollaborationModal
          kolId={completingKol.id}
          onClose={() => setCompletingKol(null)}
          onSubmit={handleComplete}
        />
      )}
    </>
  )
}
