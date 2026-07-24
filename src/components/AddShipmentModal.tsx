import { PackagePlus, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { Shipment } from '../types'
import { buildShipmentSubmitPayload } from '../utils/shipmentPayload'

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
  productOptions?: string[]
  onClose: () => void
  onSubmit: (data: ShipmentFormData) => void
}

export default function AddShipmentModal({ kolId, shipment, productOptions = [], onClose, onSubmit }: Props) {
  const [form, setForm] = useState<ShipmentFormData>({
    kol_id: kolId,
    product: shipment?.product || productOptions[0] || '',
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

  useEffect(() => {
    if (!shipment && !form.product && productOptions[0]) {
      setForm(current => ({ ...current, product: productOptions[0] }))
    }
  }, [form.product, productOptions, shipment])

  const submit = () => {
    if (!form.product.trim()) return
    onSubmit(buildShipmentSubmitPayload(form))
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[calc(100dvh-24px)] w-[560px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[12px] border border-black/[0.06] bg-white p-4 shadow-2xl sm:max-h-[86vh] sm:max-w-[calc(100vw-32px)] sm:rounded-[20px] sm:p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#1D1D1F] text-white">
              <PackagePlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#1D1D1F]">{shipment ? '编辑寄样记录' : '新增寄样记录'}</h3>
              <p className="mt-1 text-xs font-medium text-[#86868B]">维护样品、物流和签收状态。</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-black/[0.08] text-[#86868B] hover:bg-[#F5F5F7]" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">寄送产品 <span className="text-red-400">*</span></label>
            <select
              value={form.product}
              onChange={e => setForm(p => ({ ...p, product: e.target.value }))}
              disabled={productOptions.length === 0}
              className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
            >
              {productOptions.length === 0 && <option value="">请先在产品库新增产品</option>}
              {productOptions.map(product => <option key={product} value={product}>{product}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">寄样日期</label>
              <input
                type="date"
                value={form.sample_date || ''}
                onChange={e => setForm(p => ({ ...p, sample_date: e.target.value }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">快递单号</label>
              <input
                type="text"
                value={form.tracking_number}
                onChange={e => setForm(p => ({ ...p, tracking_number: e.target.value }))}
                placeholder="填入后状态进入运输中"
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
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
              className="w-full resize-y rounded-[10px] border border-black/[0.08] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">物流/寄样备注</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="仅记录物流相关信息，如第二次补寄配件 / 等对方确认地址"
              className="w-full resize-y rounded-[10px] border border-black/[0.08] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">送达日期</label>
              <input
                type="date"
                value={form.delivered_at || ''}
                disabled={form.status !== '已签收'}
                onChange={e => setForm(p => ({ ...p, delivered_at: e.target.value || null }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <p className="text-[11px] text-gray-400 mt-1">只有选择已签收时才记录送达日期</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">物流状态</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value, delivered_at: e.target.value === '已签收' ? (p.delivered_at || new Date().toISOString().slice(0, 10)) : null }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
              >
                <option value="待寄出">待寄出</option>
                <option value="运输中">运输中</option>
                <option value="已签收">已签收</option>
              </select>
            </div>
          </div>

        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-black/[0.06] pt-4">
          <button onClick={onClose} className="h-10 rounded-[10px] px-4 text-sm font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">取消</button>
          <button
            onClick={submit}
            disabled={!form.product.trim()}
            className="h-10 rounded-[10px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.35)] transition disabled:opacity-50"
          >
            保存寄样
          </button>
        </div>
      </div>
    </div>
  )
}
