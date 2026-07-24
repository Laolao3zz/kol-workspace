import { useState, useEffect, useMemo } from 'react'
import { Clock, LayoutDashboard, LayoutGrid, LogOut, Package, Settings, Users } from 'lucide-react'
import youyeetooLogo from './assets/youyeetoo-logo.png'
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
import AccountSettingsModal from './components/AccountSettingsModal'
import { collectProductOptions } from './utils/productOptions'
import { collectTagOptions } from './utils/tags'
import { countActiveShipments } from './utils/workspaceViews'
import { useAuth } from './auth/AuthProvider'

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
  const { email, username, isDemo, updateUsername, signOut } = useAuth()
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
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const displayName = username || email.split('@')[0] || '内部成员'
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

  const handleSignOut = () => {
    void signOut().catch(err => {
      setError(err instanceof Error ? err.message : '退出登录失败')
    })
  }

  return (
    <ErrorBoundary>
      <div
        className="flex h-[100dvh] overflow-hidden bg-[#F4F5F7] text-[#1D1D1F]"
        style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        {error && (
          <div className="fixed left-3 right-3 top-3 z-[90] rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg sm:left-auto sm:right-5 sm:top-5 sm:max-w-md">
            {error}
            <button onClick={() => setError(null)} className="ml-3 font-bold hover:text-red-900">&times;</button>
          </div>
        )}

        <Sidebar
          active={viewMode}
          onNav={handleNavigate}
          kolsCount={kols.length}
          progressCount={progressCount}
          email={email}
          username={displayName}
          isDemo={isDemo}
          onOpenAccount={() => setShowAccountSettings(true)}
          onSignOut={handleSignOut}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <PageHeader page={viewMode} username={displayName} isDemo={isDemo} onOpenAccount={() => setShowAccountSettings(true)} />

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
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
              <div className="flex-1 overflow-auto p-2.5 sm:p-4 xl:px-6">
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
              <div className="flex-1 overflow-hidden p-2.5 sm:p-4 xl:px-6">
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

        {showAccountSettings && !isDemo && (
          <AccountSettingsModal
            email={email}
            username={username}
            onClose={() => setShowAccountSettings(false)}
            onSave={updateUsername}
            onSignOut={handleSignOut}
          />
        )}

        <MobileNavigation active={viewMode} onNav={handleNavigate} kolsCount={kols.length} progressCount={progressCount} />
      </div>
    </ErrorBoundary>
  )
}

function Sidebar({
  active,
  onNav,
  kolsCount,
  progressCount,
  email,
  username,
  isDemo,
  onOpenAccount,
  onSignOut,
}: {
  active: ViewMode
  onNav: (mode: ViewMode) => void
  kolsCount: number
  progressCount: number
  email: string
  username: string
  isDemo: boolean
  onOpenAccount: () => void
  onSignOut: () => void
}) {
  return (
    <aside className="hidden min-h-[100dvh] w-[216px] shrink-0 flex-col border-r border-black/[0.07] bg-white md:flex">
      <div className="px-5 pb-5 pt-6">
        <div>
          <img src={youyeetooLogo} alt="Youyeetoo 风火轮机器人 Logo" className="h-auto w-full max-w-[176px]" />
          <div className="mt-2 border-t border-black/[0.07] pt-2 text-[12px] font-extrabold text-[#1D1D1F]">Youyeetoo KOL Hub</div>
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
        <div className="flex items-center gap-2 rounded-[8px] px-3 py-2.5">
          <button type="button" onClick={isDemo ? undefined : onOpenAccount} className="flex min-w-0 flex-1 items-center gap-2 text-left" title={isDemo ? undefined : '账号设置'}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-xs font-bold text-white">{isDemo ? '演' : username.slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-[#1D1D1F]">{username}</div>
              <div className="truncate text-[10px] text-[#6E6E73]">{isDemo ? '未连接 Supabase' : email}</div>
            </div>
            {!isDemo && <Settings className="h-3.5 w-3.5 shrink-0 text-[#AEAEB2]" />}
          </button>
          {!isDemo && (
            <button onClick={onSignOut} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#86868B] hover:bg-[#F4F5F7] hover:text-[#1D1D1F]" title="退出登录">
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

function PageHeader({ page, username, isDemo, onOpenAccount }: { page: ViewMode; username: string; isDemo: boolean; onOpenAccount: () => void }) {
  const meta = PAGE_META[page]
  const sub = page === 'dashboard' ? formatTodayLabel() : meta.sub
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-black/[0.07] bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <img src={youyeetooLogo} alt="Youyeetoo" className="h-auto w-[82px] shrink-0 md:hidden" />
        <h1 className="truncate text-[17px] font-extrabold text-[#1D1D1F] sm:text-[18px]">{meta.title}</h1>
        <span className="hidden text-sm text-[#AEAEB2] sm:inline">·</span>
        <span className="hidden truncate text-[13px] font-medium text-[#6E6E73] sm:inline">{sub}</span>
      </div>
      {!isDemo && (
        <button onClick={onOpenAccount} className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1D1D1F] text-xs font-extrabold text-white md:hidden" title={`${username} · 账号设置`}>
          {username.slice(0, 1).toUpperCase()}
        </button>
      )}
    </div>
  )
}

function MobileNavigation({ active, onNav, kolsCount, progressCount }: { active: ViewMode; onNav: (mode: ViewMode) => void; kolsCount: number; progressCount: number }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-black/[0.08] bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      {NAV_ITEMS.map(item => {
        const Icon = item.icon
        const selected = active === item.id
        const count = item.id === 'table' ? kolsCount : item.id === 'progress' ? progressCount : 0
        return (
          <button key={item.id} onClick={() => onNav(item.id)} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-bold ${selected ? 'text-[#0066FF]' : 'text-[#86868B]'}`}>
            <span className={`relative flex h-7 w-10 items-center justify-center rounded-[8px] ${selected ? 'bg-[#EAF2FF]' : ''}`}>
              <Icon className="h-[18px] w-[18px]" />
              {count > 0 && <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-[#1D1D1F] px-1 text-[9px] leading-4 text-white">{count > 99 ? '99+' : count}</span>}
            </span>
            <span className="max-w-full truncate">{item.label.replace('KOL ', '')}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default App
