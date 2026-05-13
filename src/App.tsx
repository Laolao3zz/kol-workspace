import { useState, useEffect } from 'react'
import { KOL, Invitation, Shipment } from './types'
import { getKOLs, createKOL, updateKOL, deleteKOL } from './services/kolService'
import { getInvitationsByKOL } from './services/invitationService'
import { getShipments } from './services/shipmentService'
import KolTable from './components/KolTable'
import KolDrawer from './components/KolDrawer'
import ShipmentBoard from './components/ShipmentBoard'
import ErrorBoundary from './components/ErrorBoundary'
import type { KolFormData } from './components/AddKolModal'

type ViewMode = 'table' | 'shipment'

function App() {
  const [kols, setKols] = useState<KOL[]>([])
  const [invitations, setInvitations] = useState<Record<string, Invitation[]>>({})
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedKol, setSelectedKol] = useState<KOL | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  const loadAll = async () => {
    try {
      setLoading(true)
      setError(null)
      const [data, shipmentData] = await Promise.all([
        getKOLs(),
        getShipments(),
      ])
      setKols(data)
      setShipments(shipmentData)
      const invMap: Record<string, Invitation[]> = {}
      await Promise.all(data.map(async kol => {
        try {
          invMap[kol.id] = await getInvitationsByKOL(kol.id)
        } catch { invMap[kol.id] = [] }
      }))
      setInvitations(invMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const handleCreateKol = async (data: KolFormData) => {
    try {
      const newKol = await createKOL(data)
      setKols(prev => [newKol, ...prev])
      setInvitations(prev => ({ ...prev, [newKol.id]: [] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleUpdateKol = async (updated: KOL) => {
    try {
      const result = await updateKOL(updated.id, updated)
      setKols(prev => prev.map(k => k.id === result.id ? result : k))
      setSelectedKol(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  const handleDeleteKol = async (id: string) => {
    if (!confirm('确定要删除该 KOL 及其所有关联数据？此操作不可撤销。')) return
    try {
      await deleteKOL(id)
      setKols(prev => prev.filter(k => k.id !== id))
      const newInv = { ...invitations }
      delete newInv[id]
      setInvitations(newInv)
      if (selectedKol?.id === id) setSelectedKol(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  const refreshInvitations = async (kolId: string) => {
    try {
      const data = await getInvitationsByKOL(kolId)
      setInvitations(prev => ({ ...prev, [kolId]: data }))
    } catch {}
  }

  const refreshShipments = async () => {
    try {
      const data = await getShipments()
      setShipments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '寄样记录加载失败')
    }
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {error && (
          <div className="fixed top-4 right-4 z-[60] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg shadow-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-3 font-bold hover:text-red-900">&times;</button>
          </div>
        )}

        <div className="max-w-[1600px] mx-auto p-4">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 mb-4 bg-white rounded-xl p-1 shadow-sm border border-gray-200 w-fit">
            <button
              onClick={() => setViewMode('table')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
               KOL 资源池
            </button>
            <button
              onClick={() => setViewMode('shipment')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                viewMode === 'shipment'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              寄样看板
            </button>
          </div>

          {viewMode === 'table' ? (
            <KolTable
              kols={kols}
              invitations={invitations}
              loading={loading}
              onSelect={setSelectedKol}
              selectedId={selectedKol?.id || null}
              onCreate={handleCreateKol}
              onDelete={handleDeleteKol}
              onRefresh={loadAll}
            />
          ) : (
            <ShipmentBoard
              kols={kols}
              shipments={shipments}
              onSelect={setSelectedKol}
              onUpdate={handleUpdateKol}
              onShipmentsChange={refreshShipments}
            />
          )}
        </div>

        {selectedKol && (
          <KolDrawer
            kol={selectedKol}
            shipments={shipments}
            onClose={() => {
              setSelectedKol(null)
              refreshInvitations(selectedKol.id)
            }}
            onUpdate={handleUpdateKol}
            onShipmentsChange={refreshShipments}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
