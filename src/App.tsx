import { useState, useEffect } from 'react'
import { KOL } from './types'
import { createKOL, deleteKOL } from './services/kolService'
import { countCompletedCollaborations } from './utils/kolStatus'
import { useKolData } from './hooks/useKolData'
import KolTable from './components/KolTable'
import KolDrawer from './components/KolDrawer'
import ShipmentBoard from './components/ShipmentBoard'
import ErrorBoundary from './components/ErrorBoundary'
import type { KolFormData } from './components/AddKolModal'

type ViewMode = 'table' | 'progress'

function App() {
  const {
    kols,
    invitations,
    shipments,
    collaborationsByKol,
    loading,
    error: dataError,
    refreshAll,
    refreshInvitations,
    refreshShipments,
    refreshCollaborations,
    updateKolOptimistic,
  } = useKolData()

  const [error, setError] = useState<string | null>(null)
  const [selectedKol, setSelectedKol] = useState<KOL | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')

  // 同步数据加载错误到本地状态
  useEffect(() => {
    if (dataError) {
      setError(dataError)
    }
  }, [dataError])

  // 当 kols 更新时，同步更新 selectedKol
  useEffect(() => {
    if (selectedKol) {
      const updated = kols.find(k => k.id === selectedKol.id)
      if (updated) {
        setSelectedKol(updated)
      }
    }
  }, [kols, selectedKol])

  const handleCreateKol = async (data: KolFormData) => {
    try {
      await createKOL(data)
      await refreshAll()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const handleUpdateKol = async (id: string, updates: Partial<KOL>) => {
    try {
      const result = await updateKolOptimistic(id, updates)
      setError(null)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    }
  }

  const handleDeleteKol = async (id: string) => {
    if (!confirm('确定要删除该 KOL 及其所有关联数据？此操作不可撤销。')) return
    try {
      await deleteKOL(id)
      await refreshAll()
      if (selectedKol?.id === id) setSelectedKol(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
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
              onClick={() => setViewMode('progress')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                viewMode === 'progress'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              进度跟踪
            </button>
          </div>

          {viewMode === 'table' ? (
            <KolTable
              kols={kols}
              invitations={invitations}
              collaborationsByKol={collaborationsByKol}
              loading={loading}
              onSelect={setSelectedKol}
              selectedId={selectedKol?.id || null}
              onCreate={handleCreateKol}
              onDelete={handleDeleteKol}
              onRefresh={refreshAll}
            />
          ) : (
            <ShipmentBoard
              kols={kols}
              invitations={invitations}
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
            collaborationCount={countCompletedCollaborations(collaborationsByKol[selectedKol.id] || [])}
            onClose={() => {
              setSelectedKol(null)
            }}
            onUpdate={handleUpdateKol}
            onInvitationsChange={() => refreshInvitations(selectedKol.id)}
            onCollaborationsChange={refreshCollaborations}
            onShipmentsChange={refreshShipments}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
