import { useState, useEffect } from 'react'
import type { Shipment } from '../types'

export interface ShipmentFormData {
  kol_id: string
  product: string
  sample_date: string | null
  tracking_number: string
  shipping_details: string
  status: string
  notes: string
  delivered_at: string | null
  progress_status: string
  progress_notes: string
  expected_publish_date: string | null
  completed_at: string | null
}

interface Props {
  kolId: string
  shipment?: Shipment | null
  onClose: () => void
  onSubmit: (data: ShipmentFormData) => void
}

export default function AddShipmentModal({ kolId, shipment, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ShipmentFormData>({
    kol_id: kolId,
    product: '',
    sample_date: '',
    tracking_number: '',
    shipping_details: '',
    status: '待寄出',
    notes: '',
    delivered_at: null,
    progress_status: '待制作',
    progress_notes: '',
    expected_publish_date: null,
    completed_at: null,
  })

  useEffect(() => {
    if (!shipment) return
    setForm({
      kol_id: shipment.kol_id,
      product: shipment.product || '',
      sample_date: shipment.sample_date || '',
      tracking_number: shipment.tracking_number || '',
      shipping_details: shipment.shipping_details || '',
      status: shipment.status || '待寄出',
      notes: shipment.notes || '',
      delivered_at: shipment.delivered_at || null,
      progress_status: shipment.progress_status || '待制作',
      progress_notes: shipment.progress_notes || '',
      expected_publish_date: shipment.expected_publish_date || null,
      completed_at: shipment.completed_at || null,
    })
  }, [shipment])

  const submit = () => {
    const product = form.product.trim()
    if (!product) return
    const tracking = form.tracking_number.trim()
    const status = form.status === '已签收' ? '已签收' : tracking ? '运输中' : '待寄出'
    const deliveredAt = status === '已签收' ? (form.delivered_at || new Date().toISOString().slice(0, 10)) : null
    onSubmit({
      ...form,
      product,
      sample_date: form.sample_date || null,
      tracking_number: tracking,
      shipping_details: form.shipping_details.trim(),
      notes: form.notes.trim(),
      delivered_at: deliveredAt,
      expected_publish_date: null,
      completed_at: form.completed_at || null,
      progress_notes: form.progress_notes.trim(),
      status,
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[560px] max-h-[86vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{shipment ? '编辑寄样记录' : '新增寄样记录'}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">寄送产品 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.product}
              onChange={e => setForm(p => ({ ...p, product: e.target.value }))}
              placeholder="手动输入产品名称，如 BY53 / K1"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">寄样日期</label>
              <input
                type="date"
                value={form.sample_date || ''}
                onChange={e => setForm(p => ({ ...p, sample_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">快递单号</label>
              <input
                type="text"
                value={form.tracking_number}
                onChange={e => setForm(p => ({ ...p, tracking_number: e.target.value }))}
                placeholder="填入后状态进入运输中"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">收件详情</label>
            <textarea
              value={form.shipping_details}
              onChange={e => setForm(p => ({ ...p, shipping_details: e.target.value }))}
              rows={3}
              placeholder="姓名、电话、地址、收件注意事项"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50 resize-y"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">物流/寄样备注</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="仅记录物流相关信息，如第二次补寄配件 / 等对方确认地址"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50 resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">送达日期</label>
              <input
                type="date"
                value={form.delivered_at || ''}
                disabled={form.status !== '已签收'}
                onChange={e => setForm(p => ({ ...p, delivered_at: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <p className="text-[11px] text-gray-400 mt-1">只有选择已签收时才记录送达日期</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">物流状态</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value, delivered_at: e.target.value === '已签收' ? (p.delivered_at || new Date().toISOString().slice(0, 10)) : null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400/50"
              >
                <option value="待寄出">待寄出</option>
                <option value="运输中">运输中</option>
                <option value="已签收">已签收</option>
              </select>
            </div>
          </div>

        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">取消</button>
          <button
            onClick={submit}
            disabled={!form.product.trim()}
            className="px-5 py-2 text-sm bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 shadow-sm transition-all font-medium disabled:opacity-50"
          >
            保存寄样
          </button>
        </div>
      </div>
    </div>
  )
}
