/**
 * 统一的 KOL 数据管理 Hook
 * 集中处理数据获取、更新和状态同步
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { KOL, Invitation, Shipment, Collaboration, Product } from '../types'
import { getKOLs, updateKOL } from '../services/kolService'
import { getInvitations, getInvitationsByKOL } from '../services/invitationService'
import { getShipments, getShipmentsByKOL } from '../services/shipmentService'
import { getCollaborations, getCollaborationsByKOL } from '../services/collaborationService'
import { getProducts } from '../services/productService'
import { applyKolSnapshot } from '../utils/kolStatus'
import { logError } from '../utils/logger'
import { groupRecordsByKol, replaceRecordsForKol } from '../utils/kolRecords'

interface UseKolDataReturn {
  kols: KOL[]
  products: Product[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
  loading: boolean
  error: string | null
  refreshAll: () => Promise<void>
  refreshKol: (kolId: string) => Promise<void>
  refreshProducts: () => Promise<void>
  refreshInvitations: (kolId: string) => Promise<void>
  refreshShipments: () => Promise<void>
  refreshCollaborations: () => Promise<void>
  updateKolOptimistic: (id: string, updates: Partial<KOL>) => Promise<KOL>
}

interface KolDataSnapshot {
  kols: KOL[]
  products: Product[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
}

export function useKolData(): UseKolDataReturn {
  const [kols, setKols] = useState<KOL[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [invitations, setInvitations] = useState<Record<string, Invitation[]>>({})
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [collaborationsByKol, setCollaborationsByKol] = useState<Record<string, Collaboration[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const stateRef = useRef<KolDataSnapshot>({
    kols: [],
    products: [],
    invitations: {},
    shipments: [],
    collaborationsByKol: {},
  })

  const commitData = useCallback((next: Partial<KolDataSnapshot>) => {
    const snapshot = { ...stateRef.current, ...next }
    stateRef.current = snapshot

    if (next.kols) setKols(next.kols)
    if (next.products) setProducts(next.products)
    if (next.invitations) setInvitations(next.invitations)
    if (next.shipments) setShipments(next.shipments)
    if (next.collaborationsByKol) setCollaborationsByKol(next.collaborationsByKol)

    return snapshot
  }, [])

  const normalizeKols = useCallback((
    kolList: KOL[],
    shipmentList: Shipment[],
    invMap: Record<string, Invitation[]>,
    colMap: Record<string, Collaboration[]>
  ) => {
    const shipmentMap = groupRecordsByKol(shipmentList)
    return kolList.map(kol => applyKolSnapshot(
      kol,
      invMap[kol.id] || [],
      shipmentMap[kol.id] || [],
      colMap[kol.id] || []
    ))
  }, [])

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [kolData, productData, invitationData, shipmentData, collaborationData] = await Promise.all([
        getKOLs(),
        getProducts(),
        getInvitations(),
        getShipments(),
        getCollaborations(),
      ])

      const kolIds = kolData.map(kol => kol.id)
      const colMap = groupRecordsByKol(collaborationData, kolIds)
      const invMap = groupRecordsByKol(invitationData, kolIds)

      commitData({
        kols: normalizeKols(kolData, shipmentData, invMap, colMap),
        products: productData,
        invitations: invMap,
        shipments: shipmentData,
        collaborationsByKol: colMap,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载数据失败'
      setError(message)
      logError('refreshAll', err)
    } finally {
      setLoading(false)
    }
  }, [commitData, normalizeKols])

  const refreshKol = useCallback(async (kolId: string) => {
    try {
      const [invData, shipmentData, colData] = await Promise.all([
        getInvitationsByKOL(kolId),
        getShipmentsByKOL(kolId),
        getCollaborationsByKOL(kolId),
      ])

      const current = stateRef.current
      const nextInvitations = { ...current.invitations, [kolId]: invData }
      const nextShipments = replaceRecordsForKol(current.shipments, kolId, shipmentData)
      const nextCollaborations = { ...current.collaborationsByKol, [kolId]: colData }

      commitData({
        invitations: nextInvitations,
        shipments: nextShipments,
        collaborationsByKol: nextCollaborations,
        kols: normalizeKols(current.kols, nextShipments, nextInvitations, nextCollaborations),
      })
    } catch (err) {
      logError('refreshKol', err, { kolId })
      throw err
    }
  }, [commitData, normalizeKols])

  const refreshProducts = useCallback(async () => {
    try {
      commitData({ products: await getProducts() })
    } catch (err) {
      logError('refreshProducts', err)
      throw err
    }
  }, [commitData])

  const refreshInvitations = useCallback(async (kolId: string) => {
    try {
      const data = await getInvitationsByKOL(kolId)
      const current = stateRef.current
      const nextInvitations = { ...current.invitations, [kolId]: data }
      commitData({
        invitations: nextInvitations,
        kols: normalizeKols(current.kols, current.shipments, nextInvitations, current.collaborationsByKol),
      })
    } catch (err) {
      logError('refreshInvitations', err, { kolId })
      throw err
    }
  }, [commitData, normalizeKols])

  const refreshShipments = useCallback(async () => {
    try {
      const data = await getShipments()
      const current = stateRef.current
      commitData({
        shipments: data,
        kols: normalizeKols(current.kols, data, current.invitations, current.collaborationsByKol),
      })
    } catch (err) {
      logError('refreshShipments', err)
      throw err
    }
  }, [commitData, normalizeKols])

  const refreshCollaborations = useCallback(async () => {
    try {
      const data = await getCollaborations()
      const current = stateRef.current
      const colMap = groupRecordsByKol(data, current.kols.map(kol => kol.id))
      commitData({
        collaborationsByKol: colMap,
        kols: normalizeKols(current.kols, current.shipments, current.invitations, colMap),
      })
    } catch (err) {
      logError('refreshCollaborations', err)
      throw err
    }
  }, [commitData, normalizeKols])

  const updateKolOptimistic = useCallback(async (id: string, updates: Partial<KOL>) => {
    // 保存原始数据用于回滚
    const originalKols = [...stateRef.current.kols]

    try {
      // 1. 乐观更新：立即更新 UI
      commitData({ kols: originalKols.map(k => k.id === id ? { ...k, ...updates } : k) })

      // 2. 发送到服务器
      const result = await updateKOL(id, updates)

      // 3. 用服务器返回的数据更新（包含计算后的状态）
      const current = stateRef.current
      const nextKol = applyKolSnapshot(
        result,
        current.invitations[result.id] || [],
        current.shipments.filter(s => s.kol_id === result.id),
        current.collaborationsByKol[result.id] || []
      )

      commitData({ kols: stateRef.current.kols.map(k => k.id === result.id ? nextKol : k) })

      return nextKol
    } catch (err) {
      // 4. 失败时回滚
      commitData({ kols: originalKols })
      logError('updateKolOptimistic', err, { id, updates })
      throw err
    }
  }, [commitData])

  useEffect(() => {
    refreshAll()
  }, [refreshAll]) // 只在组件挂载时执行一次

  return {
    kols,
    products,
    invitations,
    shipments,
    collaborationsByKol,
    loading,
    error,
    refreshAll,
    refreshKol,
    refreshProducts,
    refreshInvitations,
    refreshShipments,
    refreshCollaborations,
    updateKolOptimistic,
  }
}
