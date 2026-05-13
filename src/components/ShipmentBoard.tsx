import { useMemo, useState } from 'react'
import { KOL, Shipment } from '../types'
import { createCollaboration } from '../services/collaborationService'
import { updateShipment } from '../services/shipmentService'
import AddCollaborationModal, { CollaborationFormData } from './AddCollaborationModal'

interface Props {
  kols: KOL[]
  shipments: Shipment[]
  onSelect: (kol: KOL) => void
  onUpdate: (kol: KOL) => Promise<void> | void
  onShipmentsChange: () => Promise<void> | void
}

export default function ShipmentBoard({ kols, shipments, onSelect, onUpdate, onShipmentsChange }: Props) {
  const [completingShipment, setCompletingShipment] = useState<Shipment | null>(null)
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({})

  const kolMap = useMemo(() => new Map(kols.map(k => [k.id, k])), [kols])

  const columns = useMemo(() => {
    const pending = shipments.filter(s => s.status === '待寄出')
    const transit = shipments.filter(s => s.status === '运输中')
    const delivered = shipments.filter(s => s.status === '已签收')

    return [
      { key: 'pending', label: '待寄出', icon: '📋', color: 'border-l-amber-500', bg: 'bg-amber-50/30', shipments: pending },
      { key: 'transit', label: '运输中', icon: '🚚', color: 'border-l-blue-500', bg: 'bg-blue-50/30', shipments: transit },
      { key: 'delivered', label: '已签收', icon: '✅', color: 'border-l-emerald-500', bg: 'bg-emerald-50/30', shipments: delivered },
    ]
  }, [shipments])

  const syncKolSnapshot = async (shipment: Shipment, status: string) => {
    const kol = kolMap.get(shipment.kol_id)
    if (!kol) return
    await onUpdate({
      ...kol,
      sample_product: shipment.product,
      sample_date: shipment.sample_date || null,
      tracking_number: shipment.tracking_number || '',
      shipping_details: shipment.shipping_details || '',
      status,
      updated_at: new Date().toISOString(),
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
    const saved = await updateShipment(shipment.id, {
      status: '已签收',
      delivered_at: new Date().toISOString().slice(0, 10),
    })
    await syncKolSnapshot(saved, '已签收')
    await onShipmentsChange()
  }

  const handleComplete = async (data: CollaborationFormData) => {
    if (!completingShipment) return
    const kol = kolMap.get(completingShipment.kol_id)
    try {
      await createCollaboration({
        kol_id: completingShipment.kol_id,
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
      if (kol) await onUpdate({ ...kol, status: '合作完成', updated_at: new Date().toISOString() })
      await onShipmentsChange()
    } catch {
      if (kol) await onUpdate({ ...kol, status: '合作完成', updated_at: new Date().toISOString() })
      await onShipmentsChange()
    }
    setCompletingShipment(null)
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
                <span className="text-xs font-medium text-gray-400 bg-white px-2.5 py-0.5 rounded-full border border-gray-200">{col.shipments.length}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {col.shipments.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-2xl mb-2 opacity-30">{col.icon}</p>
                  <p className="text-xs text-gray-400">暂无</p>
                </div>
              ) : (
                col.shipments.map(shipment => {
                  const kol = kolMap.get(shipment.kol_id)
                  return (
                    <div key={shipment.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
                      <div onClick={() => kol && onSelect(kol)} className="cursor-pointer">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 truncate">{kol?.name || '未知 KOL'}</h4>
                            <p className="text-[11px] text-gray-500">{kol ? `${kol.platform} · ${kol.followers}` : 'KOL 信息缺失'}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${statusBadge(shipment.status)}`}>
                            {shipment.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-gray-600 mb-1">
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">📦 {shipment.product}</span>
                        </div>
                        {shipment.sample_date && <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1"><span>📅 {shipment.sample_date}</span></div>}
                        {shipment.tracking_number && <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-1"><span>📮 {shipment.tracking_number}</span></div>}
                        {shipment.shipping_details && <div className="text-[11px] text-gray-400 mt-1 line-clamp-2">📍 {shipment.shipping_details}</div>}
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-2">
                        {col.key === 'pending' && (
                          <div className="flex gap-2 w-full">
                            <input
                              value={trackingDrafts[shipment.id] || ''}
                              onChange={e => setTrackingDrafts(prev => ({ ...prev, [shipment.id]: e.target.value }))}
                              placeholder="补充快递单号"
                              className="min-w-0 flex-1 text-[11px] px-2 py-1.5 border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <button onClick={() => handleFillTracking(shipment)} className="text-[11px] px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium shrink-0">发出</button>
                          </div>
                        )}
                        {col.key === 'transit' && (
                          <button onClick={(e) => { e.stopPropagation(); handleConfirmDelivered(shipment) }} className="text-[11px] px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">确认签收</button>
                        )}
                        {col.key === 'delivered' && (
                          <button onClick={(e) => { e.stopPropagation(); setCompletingShipment(shipment) }} className="text-[11px] px-3 py-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors font-medium">合作完成</button>
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

      {completingShipment && (
        <AddCollaborationModal
          kolId={completingShipment.kol_id}
          onClose={() => setCompletingShipment(null)}
          onSubmit={handleComplete}
        />
      )}
    </>
  )
}
