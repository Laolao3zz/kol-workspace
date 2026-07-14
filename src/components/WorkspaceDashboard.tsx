import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronRight,
  Link2,
  Mail,
  Package,
  Send,
  Truck,
  TrendingUp,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Collaboration, Invitation, KOL, Shipment } from '../types'
import { buildDashboardMetrics, getActionablePendingInvitations } from '../utils/workspaceViews'
import { getContentShapeMetricLabels, getKolContentShape } from '../utils/contentShape'
import { getAvatarTone } from '../utils/visualTone'

type NavigateTarget = 'table' | 'progress' | 'products' | 'history'
export type DashboardNavigateOptions = {
  invitationStatus?: string
}

interface Props {
  kols: KOL[]
  invitations: Record<string, Invitation[]>
  shipments: Shipment[]
  collaborationsByKol: Record<string, Collaboration[]>
  onSelectKol: (kol: KOL) => void
  onNavigate: (target: NavigateTarget, options?: DashboardNavigateOptions) => void
}

interface ActivityItem {
  id: string
  icon: ReactNode
  text: string
  time: string
}

const todayISO = () => new Date().toISOString().slice(0, 10)

const daysSince = (date?: string | null) => {
  if (!date) return 0
  const start = new Date(`${date}T00:00:00`).getTime()
  const end = new Date(`${todayISO()}T00:00:00`).getTime()
  return Math.max(0, Math.floor((end - start) / 86400000))
}

const isCompletedShipment = (shipment: Shipment) => Boolean(shipment.completed_at) || shipment.progress_status === '已完成'

const isPublishReady = (collaboration: Collaboration) => (
  Boolean(collaboration.publish_date || collaboration.work_url || collaboration.views || collaboration.likes || collaboration.comments)
)

function kolById(kols: KOL[], id: string) {
  return kols.find(kol => kol.id === id) || null
}

function fmtNumber(value: number | null | undefined) {
  if (!value) return '0'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${Math.round(value / 1000)}K`
  return String(value)
}

function relativeTime(date?: string | null) {
  const days = daysSince(date)
  if (!date) return '刚刚'
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days}天前`
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[14px] border border-black/[0.05] bg-white shadow-[0_6px_20px_rgba(0,0,0,0.05)] ${className}`}>
      {children}
    </div>
  )
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'md' ? 'h-8 w-8 text-xs' : 'h-7 w-7 text-[11px]'
  return (
    <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-bold ${getAvatarTone(name)}`}>
      {name.slice(0, 2)}
    </div>
  )
}

function MetricCard({ label, value, sub, color, accent, onClick }: { label: string; value: number; sub: string; color: string; accent: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-w-0 overflow-hidden rounded-[14px] border border-black/[0.04] px-4 py-4 text-left shadow-[0_5px_16px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0066FF]"
      style={{ background: accent }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-bold text-[#5D5D63]">{label}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#A8A8AE] transition group-hover:translate-x-0.5 group-hover:text-[#1D1D1F]" />
      </div>
      <div className="mt-1.5 text-[26px] font-extrabold leading-none tabular-nums" style={{ color }}>{value}</div>
      <div className="mt-1.5 truncate text-[11px] font-medium text-[#9A9AA0]">{sub}</div>
    </button>
  )
}

function SectionHeader({ dot, title, count, actionLabel, onClick }: { dot: string; title: string; count: number; actionLabel: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4">
      <div className="flex items-center gap-2.5">
        <div className={`h-2 w-2 rounded-full ${dot}`} />
        <span className="text-[14px] font-bold text-[#1D1D1F]">{title}</span>
        <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[11px] font-bold text-[#6E6E73]">{count}</span>
      </div>
      <button onClick={onClick} className="flex items-center gap-0.5 text-[12px] font-semibold text-[#0066FF] transition-opacity hover:opacity-70">
        {actionLabel} <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-[116px] items-center justify-center gap-2 px-5 py-9 text-sm font-medium text-[#AEAEB2]">
      {icon}
      <span>{text}</span>
    </div>
  )
}

function buildRecentActivities(kols: KOL[], pendingReplies: Invitation[], pendingShipments: Shipment[], overdueContent: Shipment[], collaborationsByKol: Record<string, Collaboration[]>): ActivityItem[] {
  const kolMap = new Map(kols.map(kol => [kol.id, kol]))
  const published = Object.entries(collaborationsByKol).flatMap(([kolId, collaborations]) => {
    const kol = kolMap.get(kolId)
    if (!kol) return []
    return collaborations
      .filter(isPublishReady)
      .map(collaboration => {
        const labels = getContentShapeMetricLabels(getKolContentShape(kol))
        return {
          id: `col-${collaboration.id}`,
          date: collaboration.publish_date || '',
          activity: {
            id: `col-${collaboration.id}`,
            icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
            text: `${kol.name} 发布《${collaboration.product}》内容，获得 ${fmtNumber(collaboration.views)} ${labels.views}`,
            time: relativeTime(collaboration.publish_date),
          },
        }
      })
  })

  const overdue = overdueContent.map(shipment => {
    const kol = kolMap.get(shipment.kol_id)
    return {
      id: `overdue-${shipment.id}`,
      date: shipment.delivered_at || '',
      activity: {
        id: `overdue-${shipment.id}`,
        icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
        text: `${kol?.name || 'KOL'} 样品签收 ${daysSince(shipment.delivered_at)} 天，内容尚未发布，请及时催稿`,
        time: relativeTime(shipment.delivered_at),
      },
    }
  })

  const replies = pendingReplies.map(invitation => {
    const kol = kolMap.get(invitation.kol_id)
    return {
      id: `reply-${invitation.id}`,
      date: invitation.invited_at,
      activity: {
        id: `reply-${invitation.id}`,
        icon: <Mail className="h-3.5 w-3.5 text-blue-500" />,
        text: `${kol?.name || 'KOL'} 收到邀约邮件（${invitation.product}），等待回复中`,
        time: relativeTime(invitation.invited_at),
      },
    }
  })

  const ships = pendingShipments.map(shipment => {
    const kol = kolMap.get(shipment.kol_id)
    return {
      id: `ship-${shipment.id}`,
      date: shipment.sample_date || shipment.created_at || '',
      activity: {
        id: `ship-${shipment.id}`,
        icon: <Package className="h-3.5 w-3.5 text-orange-500" />,
        text: `${kol?.name || 'KOL'} 的 ${shipment.product} 待安排发货`,
        time: relativeTime(shipment.sample_date || shipment.created_at),
      },
    }
  })

  return [...published, ...overdue, ...replies, ...ships]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(item => item.activity)
    .slice(0, 6)
}

export default function WorkspaceDashboard({ kols, invitations, shipments, collaborationsByKol, onSelectKol, onNavigate }: Props) {
  const metrics = buildDashboardMetrics({ kols, invitations, shipments, collaborationsByKol })
  const availableKolIds = new Set(kols.filter(kol => !kol.blacklisted_at).map(kol => kol.id))
  const pendingReplies = getActionablePendingInvitations(invitations, shipments, collaborationsByKol)
    .filter(invitation => availableKolIds.has(invitation.kol_id))
  const pendingShipments = shipments.filter(shipment => availableKolIds.has(shipment.kol_id) && !shipment.archived_at && shipment.status === '待寄出' && !shipment.tracking_number?.trim())
  const inTransitSoon = shipments.filter(shipment => availableKolIds.has(shipment.kol_id) && !shipment.archived_at && shipment.status === '运输中').length
  const contentFollowUps = shipments
    .filter(shipment => availableKolIds.has(shipment.kol_id) && !shipment.archived_at && shipment.status === '已签收' && !isCompletedShipment(shipment))
    .sort((a, b) => daysSince(b.delivered_at) - daysSince(a.delivered_at))
  const overdueContent = contentFollowUps.filter(shipment => daysSince(shipment.delivered_at) >= 7)
  const waitingArchive = shipments.filter(shipment => availableKolIds.has(shipment.kol_id) && !shipment.archived_at && isCompletedShipment(shipment))
  const recentActivities = buildRecentActivities(kols, pendingReplies, pendingShipments, overdueContent, collaborationsByKol)

  const stats = [
    { label: 'KOL 总量', value: metrics.totalKols, sub: '查看资源池', color: '#1D1D1F', accent: '#F8F8FA', onClick: () => onNavigate('table') },
    { label: '待回复', value: pendingReplies.length, sub: '邀约跟进', color: '#0066FF', accent: '#EEF4FF', onClick: () => onNavigate('table', { invitationStatus: 'pending' }) },
    { label: '待寄出', value: pendingShipments.length, sub: '补充物流信息', color: '#C76B00', accent: '#FFF7E8', onClick: () => onNavigate('progress') },
    { label: '运输中', value: metrics.inTransit, sub: `${inTransitSoon} 件在途`, color: '#0066FF', accent: '#EEF4FF', onClick: () => onNavigate('progress') },
    { label: '内容跟进', value: metrics.contentFollowUp, sub: `${overdueContent.length} 件逾期`, color: '#D92D20', accent: '#FFF1F0', onClick: () => onNavigate('progress') },
    { label: '待归档', value: metrics.waitingArchive, sub: '补充作品数据', color: '#6E6E73', accent: '#F8F8FA', onClick: () => onNavigate('history') },
    { label: '已完成', value: metrics.completedCollaborations, sub: '查看合作历史', color: '#168653', accent: '#EFFAF4', onClick: () => onNavigate('history') },
  ]

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-8 py-6">
      <div className="grid grid-cols-7 gap-3">
        {stats.map(stat => <MetricCard key={stat.label} {...stat} />)}
      </div>

      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2 2xl:grid-cols-4">
        <Card className="h-[244px]">
          <SectionHeader dot="bg-amber-400" title="待回复邀约" count={pendingReplies.length} actionLabel="全部" onClick={() => onNavigate('table', { invitationStatus: 'pending' })} />
          <div className="py-1">
            {pendingReplies.slice(0, 3).map(invitation => {
              const kol = kolById(kols, invitation.kol_id)
              if (!kol) return null
              return (
                <button key={invitation.id} onClick={() => onSelectKol(kol)} className="mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-xl px-5 py-3 text-left transition-colors hover:bg-[#F5F5F7]">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={kol.name} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-[#1D1D1F]">{kol.name}</div>
                      <div className="truncate text-[11px] text-[#6E6E73]">{invitation.product} · {invitation.invited_at}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#E8F0FF] px-3 py-1.5 text-[11px] font-semibold text-[#0066FF]">催回复</span>
                </button>
              )
            })}
            {pendingReplies.length === 0 && <EmptyState icon={<Send className="h-5 w-5" />} text="暂无待回复邀约" />}
          </div>
        </Card>

        <Card className="h-[244px]">
          <SectionHeader dot="bg-red-500" title="签收超7天未发布" count={overdueContent.length} actionLabel="查看" onClick={() => onNavigate('progress')} />
          <div className="py-1">
            {overdueContent.slice(0, 3).map(shipment => {
              const kol = kolById(kols, shipment.kol_id)
              if (!kol) return null
              return (
                <button key={shipment.id} onClick={() => onSelectKol(kol)} className="mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-xl px-5 py-3 text-left transition-colors hover:bg-[#F5F5F7]">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={kol.name} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-[#1D1D1F]">{kol.name}</div>
                      <div className="truncate text-[11px] text-[#6E6E73]">{shipment.product} · 签收{daysSince(shipment.delivered_at)}天</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
                    <AlertTriangle className="h-3 w-3" /> 催稿
                  </span>
                </button>
              )
            })}
            {overdueContent.length === 0 && <EmptyState icon={<AlertTriangle className="h-5 w-5" />} text="暂无内容跟进风险" />}
          </div>
        </Card>

        <Card className="h-[244px]">
          <SectionHeader dot="bg-blue-400" title="待寄出样品" count={pendingShipments.length} actionLabel="查看" onClick={() => onNavigate('progress')} />
          <div className="py-1">
            {pendingShipments.slice(0, 3).map(shipment => {
              const kol = kolById(kols, shipment.kol_id)
              if (!kol) return null
              return (
                <button key={shipment.id} onClick={() => onSelectKol(kol)} className="mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-xl px-5 py-3 text-left transition-colors hover:bg-[#F5F5F7]">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={kol.name} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-[#1D1D1F]">{kol.name}</div>
                      <div className="truncate text-[11px] text-[#6E6E73]">{shipment.product} · {kol.country || '未填国家'}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#E8F0FF] px-3 py-1.5 text-[11px] font-semibold text-[#0066FF]">填写物流</span>
                </button>
              )
            })}
            {pendingShipments.length === 0 && <EmptyState icon={<Truck className="h-5 w-5" />} text="暂无待寄出样品" />}
          </div>
        </Card>

        <Card className="h-[244px]">
          <SectionHeader dot="bg-violet-400" title="待补作品链接" count={waitingArchive.length} actionLabel="查看" onClick={() => onNavigate('history')} />
          <div className="py-1">
            {waitingArchive.slice(0, 3).map(shipment => {
              const kol = kolById(kols, shipment.kol_id)
              if (!kol) return null
              return (
                <button key={shipment.id} onClick={() => onSelectKol(kol)} className="mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-xl px-5 py-3 text-left transition-colors hover:bg-[#F5F5F7]">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={kol.name} />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-[#1D1D1F]">{kol.name}</div>
                      <div className="truncate text-[11px] text-[#6E6E73]">{shipment.product} · {kol.platform}</div>
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700">添加链接</span>
                </button>
              )
            })}
            {waitingArchive.length === 0 && <EmptyState icon={<Link2 className="h-5 w-5" />} text="暂无待补作品链接" />}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-black/[0.05] px-5 py-4">
          <TrendingUp className="h-4 w-4 text-[#0066FF]" />
          <span className="text-[14px] font-bold text-[#1D1D1F]">近期动态</span>
        </div>
        <div className="py-1">
          {recentActivities.map(activity => (
            <div key={activity.id} className="mx-2 flex items-center justify-between rounded-[10px] px-5 py-3 hover:bg-[#F7F8FA]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">{activity.icon}</span>
                <span className="truncate text-[13px] font-medium text-[#1D1D1F]">{activity.text}</span>
              </div>
              <span className="shrink-0 pl-4 text-[11px] font-medium text-[#AEAEB2]">{activity.time}</span>
            </div>
          ))}
          {recentActivities.length === 0 && <EmptyState icon={<Archive className="h-5 w-5" />} text="暂无近期动态" />}
        </div>
      </Card>
    </div>
  )
}
