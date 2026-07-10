import type { Collaboration, Invitation, Shipment } from '../types'
import type { ProductCorrectionPlan } from '../utils/productCorrection'
import { getSupabase, isDemoMode } from '../lib/supabase'
import { demoDatabase } from './demoDatabase'

type CorrectionKind = 'invitation' | 'shipment' | 'collaboration'

interface CorrectionDependencies {
  updateInvitation: (record: Invitation, targetProduct: string) => Promise<void>
  updateShipment: (record: Shipment, targetProduct: string) => Promise<void>
  updateCollaboration: (record: Collaboration, targetProduct: string) => Promise<void>
}

export interface ProductCorrectionResult {
  attempted: number
  succeeded: number
  failures: Array<{ kind: CorrectionKind; id: string; message: string }>
}

type CorrectableRecord = Pick<Invitation | Shipment | Collaboration, 'id' | 'kol_id' | 'product'>

async function updateProductIfUnchanged(
  table: 'invitations' | 'shipments' | 'collaborations',
  record: CorrectableRecord,
  targetProduct: string
): Promise<void> {
  if (isDemoMode()) {
    const current = table === 'invitations'
      ? demoDatabase.getInvitationsByKOL(record.kol_id).find(candidate => candidate.id === record.id)
      : table === 'shipments'
        ? demoDatabase.getShipmentsByKOL(record.kol_id).find(candidate => candidate.id === record.id)
        : demoDatabase.getCollaborationsByKOL(record.kol_id).find(candidate => candidate.id === record.id)
    if (current?.product === targetProduct) return
    if (!current || current.product !== record.product) {
      throw new Error('记录已被其他操作修改，请刷新后重试')
    }

    if (table === 'invitations') demoDatabase.updateInvitation(record.id, { product: targetProduct })
    if (table === 'shipments') demoDatabase.updateShipment(record.id, { product: targetProduct })
    if (table === 'collaborations') demoDatabase.updateCollaboration(record.id, { product: targetProduct })
    return
  }

  const client = getSupabase()
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data, error } = await client
      .from(table)
      .update({ product: targetProduct })
      .eq('id', record.id)
      .eq('kol_id', record.kol_id)
      .eq('product', record.product)
      .select('id')

    if (!error && data?.length === 1) return

    const currentResult = await client
      .from(table)
      .select('product')
      .eq('id', record.id)
      .eq('kol_id', record.kol_id)
      .maybeSingle()
    if (currentResult.error) throw error || currentResult.error
    if (currentResult.data?.product === targetProduct) return
    if (currentResult.data?.product !== record.product) {
      throw new Error('记录已被其他操作修改，请刷新后重试')
    }
    if (attempt === 1) throw error || new Error('产品修正未生效，请重试')
  }
}

const defaultDependencies: CorrectionDependencies = {
  updateInvitation: (record, targetProduct) => updateProductIfUnchanged('invitations', record, targetProduct),
  updateShipment: (record, targetProduct) => updateProductIfUnchanged('shipments', record, targetProduct),
  updateCollaboration: (record, targetProduct) => updateProductIfUnchanged('collaborations', record, targetProduct),
}

export async function applyProductCorrection(
  plan: ProductCorrectionPlan,
  targetProduct: string,
  dependencies: CorrectionDependencies = defaultDependencies
): Promise<ProductCorrectionResult> {
  const target = targetProduct.trim()
  if (!target) throw new Error('目标产品不能为空')

  const operations = [
    ...plan.invitations.map(record => ({
      kind: 'invitation' as const,
      id: record.id,
      promise: dependencies.updateInvitation(record, target),
    })),
    ...plan.shipments.map(record => ({
      kind: 'shipment' as const,
      id: record.id,
      promise: dependencies.updateShipment(record, target),
    })),
    ...plan.collaborations.map(record => ({
      kind: 'collaboration' as const,
      id: record.id,
      promise: dependencies.updateCollaboration(record, target),
    })),
  ]

  const settled = await Promise.allSettled(operations.map(operation => operation.promise))
  const failures = settled.flatMap((result, index) => {
    if (result.status === 'fulfilled') return []
    const operation = operations[index]
    return [{
      kind: operation.kind,
      id: operation.id,
      message: result.reason instanceof Error ? result.reason.message : '更新失败',
    }]
  })

  return {
    attempted: operations.length,
    succeeded: operations.length - failures.length,
    failures,
  }
}
