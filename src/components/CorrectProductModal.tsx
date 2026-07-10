import { AlertTriangle, ArrowRight, ArrowRightLeft, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { Collaboration, Invitation, Product, Shipment } from '../types'
import { buildProductCorrectionPlan, resolveProductSelection, type ProductCorrectionPlan } from '../utils/productCorrection'

interface Props {
  kolId: string
  invitations: Invitation[]
  shipments: Shipment[]
  collaborations: Collaboration[]
  products: Product[]
  onClose: () => void
  onSubmit: (plan: ProductCorrectionPlan, targetProduct: string) => Promise<{ succeeded: number; failures: number }>
}

function uniqueProductNames(records: Array<{ product: string }>): string[] {
  return [...new Set(records.map(record => record.product?.trim()).filter((name): name is string => Boolean(name)))]
    .sort((left, right) => left.localeCompare(right))
}

export default function CorrectProductModal({
  kolId,
  invitations,
  shipments,
  collaborations,
  products,
  onClose,
  onSubmit,
}: Props) {
  const sourceOptions = useMemo(
    () => uniqueProductNames([...invitations, ...shipments, ...collaborations]),
    [collaborations, invitations, shipments]
  )
  const targetOptions = useMemo(
    () => products.filter(product => product.status !== '归档').map(product => product.name),
    [products]
  )
  const [sourceProduct, setSourceProduct] = useState(sourceOptions[0] || '')
  const [targetProduct, setTargetProduct] = useState(targetOptions[0] || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const nextSource = resolveProductSelection(sourceProduct, sourceOptions)
    if (nextSource !== sourceProduct) setSourceProduct(nextSource)
  }, [sourceOptions, sourceProduct])

  useEffect(() => {
    setTargetProduct(current => resolveProductSelection(current, targetOptions, sourceProduct))
  }, [sourceProduct, targetOptions])

  const plan = useMemo(() => buildProductCorrectionPlan({
    kolId,
    sourceProduct,
    targetProduct,
    invitations,
    shipments,
    collaborations,
  }), [collaborations, invitations, kolId, shipments, sourceProduct, targetProduct])

  const submit = async () => {
    if (plan.total === 0 || saving) return
    setSaving(true)
    setMessage('')
    try {
      const result = await onSubmit(plan, targetProduct)
      if (result.failures === 0) {
        onClose()
        return
      }
      setMessage(`已修正 ${result.succeeded} 条，另有 ${result.failures} 条失败。刷新后可再次执行。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '产品修正失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={saving ? undefined : onClose} />
      <div className="relative w-[560px] max-w-[calc(100vw-32px)] rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#1D1D1F] text-white">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#1D1D1F]">修正产品</h3>
              <p className="mt-1 text-xs font-medium text-[#86868B]">只修改当前博主的历史记录，不影响其他博主。</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-black/[0.08] text-[#86868B] transition hover:bg-[#F5F5F7] disabled:opacity-50" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        {sourceOptions.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-black/[0.08] bg-[#F5F5F7] px-4 py-8 text-center text-sm font-bold text-[#86868B]">
            当前博主没有可修正的产品记录
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] items-end gap-3">
              <label>
                <span className="mb-1.5 block text-xs font-bold text-[#6E6E73]">来源产品</span>
                <select value={sourceProduct} onChange={event => setSourceProduct(event.target.value)} className="h-10 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40">
                  {sourceOptions.map(product => <option key={product} value={product}>{product}</option>)}
                </select>
              </label>
              <div className="flex h-10 items-center justify-center text-[#86868B]"><ArrowRight className="h-4 w-4" /></div>
              <label>
                <span className="mb-1.5 block text-xs font-bold text-[#6E6E73]">目标产品</span>
                <select value={targetProduct} onChange={event => setTargetProduct(event.target.value)} className="h-10 w-full rounded-[10px] border border-black/[0.08] bg-[#F5F5F7] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40">
                  {targetOptions.map(product => <option key={product} value={product}>{product}</option>)}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <ImpactCount label="邀约" value={plan.invitations.length} />
              <ImpactCount label="寄样" value={plan.shipments.length} />
              <ImpactCount label="合作" value={plan.collaborations.length} />
            </div>

            <div className="flex items-start gap-2 rounded-[12px] border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>将把以上 {plan.total} 条记录的产品改为「{targetProduct || '-'}」。修改后产品机会、进度看板和合作历史会一起更新。</span>
            </div>
            {message && <div className="text-xs font-bold text-red-600">{message}</div>}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t border-black/[0.06] pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-[10px] px-4 text-sm font-bold text-[#6E6E73] transition hover:bg-[#F5F5F7] disabled:opacity-50">取消</button>
          <button type="button" onClick={submit} disabled={saving || plan.total === 0 || !targetProduct} className="h-10 rounded-[10px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.30)] transition disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? '正在修正...' : `确认修正 ${plan.total} 条`}
          </button>
        </div>
      </div>
    </div>
  )
}

function ImpactCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[10px] bg-[#F5F5F7] px-3 py-2 text-center">
      <div className="text-lg font-extrabold tabular-nums text-[#1D1D1F]">{value}</div>
      <div className="text-[11px] font-bold text-[#86868B]">{label}记录</div>
    </div>
  )
}
