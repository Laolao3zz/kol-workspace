/**
 * 统一的 KOL 数据管理 Hook
 * 集中处理数据获取、更新和状态同步
 */

import { useState, useEffect, useCallback } from 'react'
import { KOL, Invitation, Shipment, Collaboration } from '../types'
import { getKOLs, updateKOL } from '../services/kolService'
import { getInvitationsByKOL } from '../services/invitationService'
import { getShipments } from '../services/shipmentService'
import { getCollaborations } from '../services/collaborationService'
import { applyKolSnapshot } from '../utils/kolStatus'
import { logError } from '../utils/logger'

interface UseKolDataReturn {
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
  loading: boolean
  error: string | null
  refreshAll: () => Promise<void>
  refreshKol: (kolId: string) => Promise<void>
  refreshInvitations: (kolId: string) => Promise<void>
  refreshShipments: () => Promise<void>
  refreshCollaborations: () => Promise<void>
  updateKolOptimistic: (id: string, updates: Partial<KOL>) => Promise<KOL>
}

export function useKolData(): UseKolDataReturn {
  const [kols, setKols] = useState<KOL[]>([])
  const [invitations, setInvitations] = useState<Record<string, Invitation[]>>({})
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [collaborationsByKol, setCollaborationsByKol] = useState<Record<string, Collaboration[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const groupShipmentsByKol = useCallback((shipmentList: Shipment[]) => {
    return shipmentList.reduce<Record<string, Shipment[]>>((map, shipment) => {
      map[shipment.kol_id] = [...(map[shipment.kol_id] || []), shipment]
      return map
    }, {})
  }, [])

  const groupCollaborationsByKol = useCallback((collaborationList: Collaboration[]) => {
    return collaborationList.reduce<Record<string, Collaboration[]>>((map, collaboration) => {
      map[collaboration.kol_id] = [...(map[collaboration.kol_id] || []), collaboration]
      return map
    }, {})
  }, [])

  const normalizeKols = useCallback((
    kolList: KOL[],
    shipmentList: Shipment[],
    invMap: Record<string, Invitation[]>,
    colMap: Record<string, Collaboration[]>
  ) => {
    const shipmentMap = groupShipmentsByKol(shipmentList)
    return kolList.map(kol => applyKolSnapshot(
      kol,
      invMap[kol.id] || [],
      shipmentMap[kol.id] || [],
      colMap[kol.id] || []
    ))
  }, [groupShipmentsByKol])

  const refreshAll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [kolData, shipmentData, collaborationData] = await Promise.all([
        getKOLs(),
        getShipments(),
        getCollaborations(),
      ])

      const colMap = groupCollaborationsByKol(collaborationData)
      const invMap: Record<string, Invitation[]> = {}

      await Promise.all(kolData.map(async kol => {
        try {
          invMap[kol.id] = await getInvitationsByKOL(kol.id)
        } catch (err) {
          logError('refreshAll:getInvitations', err, { kolId: kol.id })
          invMap[kol.id] = []
        }
      }))

      setInvitations(invMap)
      setShipments(shipmentData)
      setCollaborationsByKol(colMap)
      setKols(normalizeKols(kolData, shipmentData, invMap, colMap))
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载数据失败'
      setError(message)
      logError('refreshAll', err)
    } finally {
      setLoading(false)
    }
  }, [groupCollaborationsByKol, normalizeKols])

  const refreshKol = useCallback(async (kolId: string) => {
    try {
      const [invData, shipmentData, colData] = await Promise.all([
        getInvitationsByKOL(kolId),
        getShipments(),
        getCollaborations(),
      ])

      const nextInvitations = { ...invitations, [kolId]: invData }
      const colMap = groupCollaborationsByKol(colData)

      setInvitations(nextInvitations)
      setShipments(shipmentData)
      setCollaborationsByKol(colMap)
      setKols(prev => normalizeKols(prev, shipmentData, nextInvitations, colMap))
    } catch (err) {
      logError('refreshKol', err, { kolId })
      throw err
    }
  }, [invitations, groupCollaborationsByKol, normalizeKols])

  const refreshInvitations = useCallback(async (kolId: string) => {
    try {
      const data = await getInvitationsByKOL(kolId)
      const nextInvitations = { ...invitations, [kolId]: data }
      setInvitations(nextInvitations)
      setKols(prev => normalizeKols(prev, shipments, nextInvitations, collaborationsByKol))
    } catch (err) {
      logError('refreshInvitations', err, { kolId })
      throw err
    }
  }, [invitations, shipments, collaborationsByKol, normalizeKols])

  const refreshShipments = useCallback(async () => {
    try {
      const data = await getShipments()
      setShipments(data)
      setKols(prev => normalizeKols(prev, data, invitations, collaborationsByKol))
    } catch (err) {
      logError('refreshShipments', err)
      throw err
    }
  }, [invitations, collaborationsByKol, normalizeKols])

  const refreshCollaborations = useCallback(async () => {
    try {
      const data = await getCollaborations()
      const colMap = groupCollaborationsByKol(data)
      setCollaborationsByKol(colMap)
      setKols(prev => normalizeKols(prev, shipments, invitations, colMap))
    } catch (err) {
      logError('refreshCollaborations', err)
      throw err
    }
  }, [shipments, invitations, groupCollaborationsByKol, normalizeKols])

  const updateKolOptimistic = useCallback(async (id: string, updates: Partial<KOL>) => {
    // 保存原始数据用于回滚
    const originalKols = [...kols]

    try {
      // 1. 乐观更新：立即更新 UI
      setKols(prev => prev.map(k => k.id === id ? { ...k, ...updates } : k))

      // 2. 发送到服务器
      const result = await updateKOL(id, updates)

      // 3. 用服务器返回的数据更新（包含计算后的状态）
      const nextKol = applyKolSnapshot(
        result,
        invitations[result.id] || [],
        shipments.filter(s => s.kol_id === result.id),
        collaborationsByKol[result.id] || []
      )

      setKols(prev => prev.map(k => k.id === result.id ? nextKol : k))

      return nextKol
    } catch (err) {
      // 4. 失败时回滚
      setKols(originalKols)
      logError('updateKolOptimistic', err, { id, updates })
      throw err
    }
  }, [kols, invitations, shipments, collaborationsByKol])

  useEffect(() => {
    refreshAll()
  }, []) // 只在组件挂载时执行一次

  return {
    kols,
    invitations,
    shipments,
    collaborationsByKol,
    loading,
    error,
    refreshAll,
    refreshKol,
    refreshInvitations,
    refreshShipments,
    refreshCollaborations,
    updateKolOptimistic,
  }
}
