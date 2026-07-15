import { useState, useEffect, useMemo } from 'react'
import { Bell, Clock, LayoutDashboard, LayoutGrid, Package, Plus, Star, Users } from 'lucide-react'
import { KOL, Shipment } from './types'
import { createKOL, deleteKOL } from './services/kolService'
import { countCompletedCollaborations } from './utils/kolStatus'
import { useKolData } from './hooks/useKolData'
import KolTable from './components/KolTable'
import KolDrawer from './components/KolDrawer'
import ShipmentBoard from './components/ShipmentBoard'
import ErrorBoundary from './components/ErrorBoundary'
import AddKolModal, { KolFormData } from './components/AddKolModal'
import WorkspaceDashboard, { type DashboardNavigateOptions } from './components/WorkspaceDashboard'
import ProductOpportunityView from './components/ProductOpportunityView'
import CollaborationHistoryView from './components/CollaborationHistoryView'
import { collectProductOptions } from './utils/productOptions'
import { collectTagOptions } from './utils/tags'
import { countActiveShipments } from './utils/workspaceViews'

type ViewMode = 'dashboard' | 'table' | 'progress' | 'products' | 'history'

const PAGE_META: Record<ViewMode, { title: string; sub: string }> = {
  dashboard: { title: '工作台', sub: '' },
  table: { title: 'KOL 资源池', sub: '管理所有创作者资源' },
  progress: { title: '进度看板', sub: '物流与内容全览' },
  products: { title: '产品机会', sub: '按产品查看 KOL 触达状态' },
  history: { title: '合作历史', sub: '已归档的发布内容与数据' },
}

const NAV_ITEMS: Array<{ id: ViewMode; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { id: 'table', label: 'KOL 资源池', icon: Users },
  { id: 'progress', label: '进度看板', icon: LayoutGrid },
  { id: 'products', label: '产品机会', icon: Package },
  { id: 'history', label: '合作历史', icon: Clock },
]

function formatTodayLabel() {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
  return `${year}年${month}月${day}日 · ${weekday}`
}

function countProgressBadge(shipments: Shipment[], kols: KOL[]) {
  const availableKolIds = new Set(kols.filter(kol => !kol.blacklisted_at).map(kol => kol.id))
  return countActiveShipments(shipments.filter(shipment => availableKolIds.has(shipment.kol_id)))
}

function App() {
  const {
    kols,
    products,
    invitations,
    shipments,
    collaborationsByKol,
    loading,
    error: dataError,
    refreshAll,
    refreshProducts,
    refreshInvitations,
    refreshShipments,
    refreshCollaborations,
    updateKolOptimistic,
  } = useKolData()

  const [error, setError] = useState<string | null>(null)
  const [selectedKol, setSelectedKol] = useState<KOL | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [tableInvitationStatusFilter, setTableInvitationStatusFilter] = useState<string | undefined>()
  const [showAddKolModal, setShowAddKolModal] = useState(false)
  const productOptions = useMemo(() => collectProductOptions({
    products,
    kols,
    invitations,
    shipments,
    collaborationsByKol,
  }), [products, kols, invitations, shipments, collaborationsByKol])
  const managedProductOptions = useMemo(
    () => products.filter(product => product.status !== '归档').map(product => product.name),
    [products]
  )
  const tagOptions = useMemo(
    () => collectTagOptions(kols.flatMap(kol => kol.tags || [])),
    [kols]
  )
  const progressCount = useMemo(() => countProgressBadge(shipments, kols), [shipments, kols])

  useEffect(() => {
    if (dataError) {
      setError(dataError)
    }
  }, [dataError])

  useEffect(() => {
    if (selectedKol) {
      const updated = kols.find(k => k.id === selectedKol.id)
      if (updated) {
        setSelectedKol(updated)
      }
    }
  }, [kols, selectedKol])

  const handleCreateKol = async (data: KolFormData): Promise<KOL> => {
    try {
      const created = await createKOL(data)
      setError(null)
      return created
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建失败'
      setError(message)
      throw err instanceof Error ? err : new Error(message)
    }
  }

  const refreshAfterAddKol = () => {
    setShowAddKolModal(false)
    void refreshAll().catch(err => {
      setError(err instanceof Error ? err.message : '刷新 KOL 数据失败')
    })
  }

  const handleOpenExistingKol = (kol: KOL) => {
    setSelectedKol(kol)
    refreshAfterAddKol()
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

  const handleNavigate = (mode: ViewMode, options?: DashboardNavigateOptions) => {
    setViewMode(mode)
    setSelectedKol(null)
    if (mode === 'table' && options?.invitationStatus) {
      setTableInvitationStatusFilter(options.invitationStatus)
    } else {
      setTableInvitationStatusFilter(undefined)
    }
  }

  return (
    <ErrorBoundary>
      <div
        className="flex h-screen overflow-hidden bg-[#F4F5F7] text-[#1D1D1F]"
        style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        {error && (
          <div className="fixed right-5 top-5 z-[80] rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
            {error}
            <button onClick={() => setError(null)} className="ml-3 font-bold hover:text-red-900">&times;</button>
          </div>
        )}

        <Sidebar active={viewMode} onNav={handleNavigate} kolsCount={kols.length} progressCount={progressCount} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <PageHeader
            page={viewMode}
            onAddKol={() => setShowAddKolModal(true)}
            onQuickInvite={() => setViewMode('table')}
          />

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {viewMode === 'dashboard' && (
              <WorkspaceDashboard
                kols={kols}
                invitations={invitations}
                shipments={shipments}
                collaborationsByKol={collaborationsByKol}
                onSelectKol={setSelectedKol}
                onNavigate={handleNavigate}
              />
            )}

            {viewMode === 'table' && (
              <div className="flex-1 overflow-auto p-5 xl:px-6">
                <KolTable
                  kols={kols}
                  invitations={invitations}
                  shipments={shipments}
                  collaborationsByKol={collaborationsByKol}
                  loading={loading}
                  onSelect={setSelectedKol}
                  selectedId={selectedKol?.id || null}
                  productOptions={managedProductOptions}
                  initialInvitationStatusFilter={tableInvitationStatusFilter}
                  onAddKol={() => setShowAddKolModal(true)}
                  onDelete={handleDeleteKol}
                  onRefresh={refreshAll}
                />
              </div>
            )}

            {viewMode === 'progress' && (
              <div className="flex-1 overflow-hidden p-5 xl:px-6">
                <ShipmentBoard
                  kols={kols}
                  invitations={invitations}
                  shipments={shipments}
                  onSelect={setSelectedKol}
                  onUpdate={handleUpdateKol}
                  onShipmentsChange={refreshShipments}
                  onCollaborationsChange={refreshCollaborations}
                />
              </div>
            )}

            {viewMode === 'products' && (
              <ProductOpportunityView
                products={products}
                kols={kols}
                invitations={invitations}
                shipments={shipments}
                collaborationsByKol={collaborationsByKol}
                productOptions={productOptions}
                onProductsChange={refreshProducts}
                onDataChange={refreshAll}
                onSelectKol={setSelectedKol}
              />
            )}

            {viewMode === 'history' && (
              <CollaborationHistoryView
                kols={kols}
                collaborationsByKol={collaborationsByKol}
                onSelectKol={setSelectedKol}
              />
            )}
          </main>
        </div>

        {selectedKol && (
          <KolDrawer
            kol={selectedKol}
            shipments={shipments}
            collaborationCount={countCompletedCollaborations(collaborationsByKol[selectedKol.id] || [])}
            products={products}
            productOptions={productOptions}
            tagOptions={tagOptions}
            onClose={() => setSelectedKol(null)}
            onUpdate={handleUpdateKol}
            onInvitationsChange={() => refreshInvitations(selectedKol.id)}
            onCollaborationsChange={refreshCollaborations}
            onShipmentsChange={refreshShipments}
          />
        )}

        {showAddKolModal && (
          <AddKolModal
            existingKols={kols}
            countryOptions={[...new Set(kols.map(kol => String(kol.country || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))}
            onClose={refreshAfterAddKol}
            onSubmit={handleCreateKol}
            onOpenExisting={handleOpenExistingKol}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

function Sidebar({ active, onNav, kolsCount, progressCount }: { active: ViewMode; onNav: (mode: ViewMode) => void; kolsCount: number; progressCount: number }) {
  return (
    <aside className="flex min-h-screen w-[216px] shrink-0 flex-col border-r border-black/[0.07] bg-white">
      <div className="px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#0066FF] text-white shadow-[0_4px_12px_rgba(0,102,255,0.35)]">
            <Star className="h-4 w-4" fill="white" />
          </div>
          <div>
            <div className="text-[15px] font-extrabold leading-tight text-[#1D1D1F]">KOL Hub</div>
            <div className="text-[11px] font-medium text-[#6E6E73]">品牌合作管理</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        <div className="mb-2 px-3 text-[10px] font-bold text-[#AEAEB2]">导航</div>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon
          const selected = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className={`flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-[13px] font-semibold transition-colors ${selected ? 'bg-[#EAF2FF] text-[#005FE8]' : 'text-[#626268] hover:bg-[#F4F5F7] hover:text-[#1D1D1F]'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {(item.id === 'table' || item.id === 'progress') && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selected ? 'bg-white text-[#005FE8]' : 'bg-[#F4F5F7] text-[#6E6E73]'}`}>
                  {item.id === 'table' ? kolsCount : progressCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-black/[0.06] px-3 pb-5 pt-4">
        <div className="flex cursor-pointer items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors hover:bg-[#F4F5F7]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5856D6] text-xs font-bold text-white">运</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-[#1D1D1F]">运营工作台</div>
            <div className="text-[11px] text-[#6E6E73]">KOL 管理</div>
          </div>
          <Bell className="h-4 w-4 shrink-0 text-[#AEAEB2]" />
        </div>
      </div>
    </aside>
  )
}

function PageHeader({ page, onAddKol, onQuickInvite }: { page: ViewMode; onAddKol: () => void; onQuickInvite: () => void }) {
  const meta = PAGE_META[page]
  const sub = page === 'dashboard' ? formatTodayLabel() : meta.sub
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.07] bg-white px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[18px] font-extrabold text-[#1D1D1F]">{meta.title}</h1>
        <span className="text-sm text-[#AEAEB2]">·</span>
        <span className="text-[13px] font-medium text-[#6E6E73]">{sub}</span>
      </div>
      <div className="flex items-center gap-2">
        {page === 'dashboard' && (
          <button onClick={onQuickInvite} className="flex items-center gap-1.5 rounded-[8px] bg-[#0066FF] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(0,102,255,0.25)] transition hover:bg-[#0057DB] active:scale-[0.98]">
            <Plus className="h-3.5 w-3.5" /> 快速邀约
          </button>
        )}
        {page === 'table' && (
          <button onClick={onAddKol} className="flex items-center gap-1.5 rounded-[8px] bg-[#0066FF] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(0,102,255,0.25)] transition hover:bg-[#0057DB] active:scale-[0.98]">
            <Plus className="h-3.5 w-3.5" /> 添加 KOL
          </button>
        )}
      </div>
    </div>
  )
}

export default App
