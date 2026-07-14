import type { Collaboration, Invitation, KOL, Product, Shipment } from '../types'

type DemoCounters = {
  kol: number
  invitation: number
  shipment: number
  collaboration: number
  product: number
}

type DemoState = {
  kols: KOL[]
  products: Product[]
  invitations: Invitation[]
  shipments: Shipment[]
  collaborations: Collaboration[]
  counters: DemoCounters
}

const STORAGE_KEY = 'kol-hub-demo-state-v2'
const AUTO_CREATED_SHIPMENT_NOTE = '邀约同意且我方继续推进后自动生成'

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const nowISO = () => new Date().toISOString()

const sortByDateDesc = <T>(items: T[], getDate: (item: T) => string | null | undefined): T[] => {
  return [...items].sort((a, b) => String(getDate(b) || '').localeCompare(String(getDate(a) || '')))
}

const sortCollaborations = (items: Collaboration[]): Collaboration[] => {
  return [...items].sort((a, b) => {
    const publish = String(b.publish_date || '').localeCompare(String(a.publish_date || ''))
    return publish !== 0 ? publish : b.id.localeCompare(a.id)
  })
}

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage)

function createInitialState(): DemoState {
  const kols: KOL[] = [
    {
      id: 'demo-kol-alex',
      name: 'Alex Tech Lab',
      email: 'alex@techlab.example',
      homepage_url: 'https://www.youtube.com/@alextechlab',
      platform: 'YouTube',
      followers: '820K',
      country: 'United States',
      tags: ['科技', 'Mini PC', 'AI'],
      notes: 'High-quality long-form reviewer. Prefers detailed specs before outreach.',
      status: '内容跟进',
      sample_product: 'NovaBox Mini PC',
      sample_date: '2026-06-18',
      tracking_number: '1Z-DEMO-24018',
      shipping_details: 'Alex Chen, 120 Market St, San Francisco, CA',
      created_at: '2026-05-04T09:20:00.000Z',
      updated_at: '2026-06-24T10:20:00.000Z',
    },
    {
      id: 'demo-kol-maya',
      name: 'Maya Outdoor Notes',
      email: 'maya@outdoornotes.example',
      homepage_url: 'https://www.instagram.com/mayaoutdoor',
      platform: 'Instagram',
      followers: '410K',
      country: 'Canada',
      tags: ['户外装备', 'Smart Home'],
      notes: 'Good fit for field-test samples and outdoor launch windows.',
      status: '运输中',
      sample_product: 'TrailCam X2',
      sample_date: '2026-07-02',
      tracking_number: 'DHL-DEMO-7782',
      shipping_details: 'Maya Brooks, 88 Pine Rd, Vancouver, BC',
      created_at: '2026-05-08T13:30:00.000Z',
      updated_at: '2026-07-02T15:10:00.000Z',
    },
    {
      id: 'demo-kol-radio',
      name: 'Radio Craft JP',
      email: 'radio-craft@example.jp',
      homepage_url: 'https://www.youtube.com/@radiocraftjp',
      platform: 'YouTube',
      followers: '72K',
      country: 'Japan',
      tags: ['无线电', '科技'],
      notes: '',
      status: '待寄出',
      sample_product: 'QRP Field Kit',
      sample_date: '2026-07-05',
      tracking_number: '',
      shipping_details: 'Tokyo sample desk, Shibuya, Tokyo',
      created_at: '2026-05-17T08:12:00.000Z',
      updated_at: '2026-07-05T09:35:00.000Z',
    },
    {
      id: 'demo-kol-byte',
      name: 'Byte Orchard',
      email: 'editor@byteorchard.example',
      homepage_url: 'https://byteorchard.example',
      platform: 'Blog',
      followers: '95K monthly readers',
      country: 'Germany',
      tags: ['Networking', 'Storage'],
      notes: 'Editorial lead time is usually 3-4 weeks.',
      status: '已邀约',
      sample_product: '',
      sample_date: null,
      tracking_number: '',
      shipping_details: '',
      created_at: '2026-06-01T11:00:00.000Z',
      updated_at: '2026-06-30T12:15:00.000Z',
    },
    {
      id: 'demo-kol-lin',
      name: 'Lin Storage Studio',
      email: 'lin@storagestudio.example',
      homepage_url: 'https://www.youtube.com/@linstorage',
      platform: 'YouTube',
      followers: '180K',
      country: 'Taiwan',
      tags: ['NAS', 'Storage', 'SBC'],
      notes: 'Reliable historical partner. Keep in priority list for storage products.',
      status: '合作完成',
      sample_product: 'Atlas NAS 4-bay',
      sample_date: '2026-05-14',
      tracking_number: 'SF-DEMO-55210',
      shipping_details: 'Lin Studio, Taipei',
      created_at: '2026-04-16T07:42:00.000Z',
      updated_at: '2026-06-05T08:00:00.000Z',
    },
    {
      id: 'demo-kol-zoe',
      name: 'Zoe Home Robotics',
      email: 'zoe@homerobotics.example',
      homepage_url: 'https://www.tiktok.com/@zoehomerobotics',
      platform: 'TikTok',
      followers: '1.2M',
      country: 'United Kingdom',
      tags: ['Robotics', 'Smart Home', 'AI'],
      notes: '',
      status: '已邀约',
      sample_product: '',
      sample_date: null,
      tracking_number: '',
      shipping_details: '',
      created_at: '2026-06-12T14:18:00.000Z',
      updated_at: '2026-07-01T09:00:00.000Z',
    },
  ]

  const invitations: Invitation[] = [
    {
      id: 'demo-inv-alex',
      kol_id: 'demo-kol-alex',
      product: 'NovaBox Mini PC',
      invited_at: '2026-06-10',
      email_subject: 'NovaBox Mini PC review collaboration',
      replied: true,
      reply_result: '同意合作',
      quoted_fee: 'USD 1,200 + sample',
      decision: '继续推进',
      decision_reason: '',
      notes: '要求 3 周内容制作周期。',
    },
    {
      id: 'demo-inv-maya',
      kol_id: 'demo-kol-maya',
      product: 'TrailCam X2',
      invited_at: '2026-06-28',
      email_subject: 'Outdoor field test proposal',
      replied: true,
      reply_result: '同意合作',
      quoted_fee: 'CAD 900',
      decision: '继续推进',
      decision_reason: '',
      notes: '偏好实地使用素材。',
    },
    {
      id: 'demo-inv-radio',
      kol_id: 'demo-kol-radio',
      product: 'QRP Field Kit',
      invited_at: '2026-07-04',
      email_subject: 'QRP kit hands-on review',
      replied: true,
      reply_result: '同意合作',
      quoted_fee: 'Sample only',
      decision: '继续推进',
      decision_reason: '',
      notes: '等待物流单号。',
    },
    {
      id: 'demo-inv-byte',
      kol_id: 'demo-kol-byte',
      product: 'Mesh Router Pro',
      invited_at: '2026-06-30',
      email_subject: 'Mesh Router Pro editorial sample',
      replied: false,
      reply_result: '未回复',
      quoted_fee: '',
      decision: '待评估',
      decision_reason: '',
      notes: '下周二跟进。',
    },
    {
      id: 'demo-inv-lin',
      kol_id: 'demo-kol-lin',
      product: 'Atlas NAS 4-bay',
      invited_at: '2026-05-01',
      email_subject: 'Atlas NAS long-form review',
      replied: true,
      reply_result: '同意合作',
      quoted_fee: 'USD 650',
      decision: '继续推进',
      decision_reason: '',
      notes: '已完成第一轮合作。',
    },
    {
      id: 'demo-inv-zoe',
      kol_id: 'demo-kol-zoe',
      product: 'HomeBot Dock',
      invited_at: '2026-07-01',
      email_subject: 'HomeBot Dock creator campaign',
      replied: true,
      reply_result: '拒绝合作',
      quoted_fee: '',
      decision: '待评估',
      decision_reason: '档期不合适',
      notes: '可以 9 月再联系。',
    },
  ]

  const shipments: Shipment[] = [
    {
      id: 'demo-ship-alex',
      kol_id: 'demo-kol-alex',
      product: 'NovaBox Mini PC',
      sample_date: '2026-06-18',
      tracking_number: '1Z-DEMO-24018',
      shipping_details: 'Alex Chen, 120 Market St, San Francisco, CA',
      status: '已签收',
      notes: '已提醒补 B-roll。',
      delivered_at: '2026-06-23',
      progress_status: '制作中',
      progress_notes: '脚本已过，等待性能测试片段。',
      expected_publish_date: '2026-07-18',
      completed_at: null,
      archived_at: null,
      created_at: '2026-06-18T10:00:00.000Z',
      updated_at: '2026-06-24T10:20:00.000Z',
    },
    {
      id: 'demo-ship-maya',
      kol_id: 'demo-kol-maya',
      product: 'TrailCam X2',
      sample_date: '2026-07-02',
      tracking_number: 'DHL-DEMO-7782',
      shipping_details: 'Maya Brooks, 88 Pine Rd, Vancouver, BC',
      status: '运输中',
      notes: 'DHL 已揽收。',
      delivered_at: null,
      progress_status: '待制作',
      progress_notes: '',
      expected_publish_date: '2026-08-05',
      completed_at: null,
      archived_at: null,
      created_at: '2026-07-02T15:10:00.000Z',
      updated_at: '2026-07-02T15:10:00.000Z',
    },
    {
      id: 'demo-ship-radio',
      kol_id: 'demo-kol-radio',
      product: 'QRP Field Kit',
      sample_date: '2026-07-05',
      tracking_number: '',
      shipping_details: 'Tokyo sample desk, Shibuya, Tokyo',
      status: '待寄出',
      notes: AUTO_CREATED_SHIPMENT_NOTE,
      delivered_at: null,
      progress_status: '待制作',
      progress_notes: '',
      expected_publish_date: '2026-08-20',
      completed_at: null,
      archived_at: null,
      created_at: '2026-07-05T09:35:00.000Z',
      updated_at: '2026-07-05T09:35:00.000Z',
    },
    {
      id: 'demo-ship-lin',
      kol_id: 'demo-kol-lin',
      product: 'Atlas NAS 4-bay',
      sample_date: '2026-05-14',
      tracking_number: 'SF-DEMO-55210',
      shipping_details: 'Lin Studio, Taipei',
      status: '已签收',
      notes: '等待归档补数据。',
      delivered_at: '2026-05-18',
      progress_status: '已完成',
      progress_notes: '视频已发布，待填链接和效果数据。',
      expected_publish_date: '2026-06-02',
      completed_at: '2026-06-05',
      archived_at: null,
      created_at: '2026-05-14T07:42:00.000Z',
      updated_at: '2026-06-05T08:00:00.000Z',
    },
  ]

  const collaborations: Collaboration[] = [
    {
      id: 'demo-col-lin',
      kol_id: 'demo-kol-lin',
      product: 'Atlas NAS 4-bay',
      publish_date: '2026-06-05',
      work_url: 'https://www.youtube.com/watch?v=demo-atlas-nas',
      views: 128000,
      comments: 642,
      likes: 5100,
      fee: 'USD 650',
      notes: '首周表现高于预期。',
    },
    {
      id: 'demo-col-alex-old',
      kol_id: 'demo-kol-alex',
      product: 'Pocket SBC Kit',
      publish_date: '2026-04-28',
      work_url: 'https://www.youtube.com/watch?v=demo-pocket-sbc',
      views: 96000,
      comments: 384,
      likes: 4300,
      fee: 'USD 950',
      notes: '历史合作，转化质量稳定。',
    },
  ]

  const products: Product[] = [
    {
      id: 'demo-product-atlas-nas',
      name: 'Atlas NAS 4-bay',
      category: 'Storage',
      target_kol_tags: ['NAS', 'Storage', 'SBC'],
      target_content_shapes: ['视频', '网站'],
      status: '在推',
      priority: 90,
      notes: '优先匹配 NAS、存储、SBC 类评测渠道。',
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    },
    {
      id: 'demo-product-pocket-sbc',
      name: 'Pocket SBC Kit',
      category: 'SBC',
      target_kol_tags: ['SBC', 'AI', '科技', 'Mini PC'],
      target_content_shapes: ['视频'],
      status: '在推',
      priority: 80,
      notes: '开发板类新品，默认不推荐给纯户外渠道。',
      created_at: '2026-04-02T00:00:00.000Z',
      updated_at: '2026-04-02T00:00:00.000Z',
    },
    {
      id: 'demo-product-trailcam',
      name: 'TrailCam X2',
      category: 'Outdoor',
      target_kol_tags: ['户外装备', 'Smart Home'],
      target_content_shapes: ['视频'],
      status: '在推',
      priority: 70,
      notes: '户外实测优先。',
      created_at: '2026-04-03T00:00:00.000Z',
      updated_at: '2026-04-03T00:00:00.000Z',
    },
    {
      id: 'demo-product-mesh-router',
      name: 'Mesh Router Pro',
      category: 'Networking',
      target_kol_tags: ['Networking', 'Smart Home', '科技'],
      target_content_shapes: ['视频', '网站'],
      status: '在推',
      priority: 65,
      notes: '网站评测和视频评测都适合。',
      created_at: '2026-04-04T00:00:00.000Z',
      updated_at: '2026-04-04T00:00:00.000Z',
    },
    {
      id: 'demo-product-qrp',
      name: 'QRP Field Kit',
      category: 'Radio',
      target_kol_tags: ['无线电', '户外装备', '科技'],
      target_content_shapes: ['视频'],
      status: '在推',
      priority: 60,
      notes: '小众无线电渠道优先。',
      created_at: '2026-04-05T00:00:00.000Z',
      updated_at: '2026-04-05T00:00:00.000Z',
    },
    {
      id: 'demo-product-homebot',
      name: 'HomeBot Dock',
      category: 'Robotics',
      target_kol_tags: ['Robotics', 'Smart Home', 'AI'],
      target_content_shapes: ['视频'],
      status: '暂停',
      priority: 30,
      notes: '等待下一版素材后再推进。',
      created_at: '2026-04-06T00:00:00.000Z',
      updated_at: '2026-04-06T00:00:00.000Z',
    },
    {
      id: 'demo-product-novabox',
      name: 'NovaBox Mini PC',
      category: 'Mini PC',
      target_kol_tags: ['Mini PC', '科技', 'AI'],
      target_content_shapes: ['视频'],
      status: '在推',
      priority: 85,
      notes: 'Mini PC 长视频评测优先。',
      created_at: '2026-04-07T00:00:00.000Z',
      updated_at: '2026-04-07T00:00:00.000Z',
    },
  ]

  return {
    kols,
    products,
    invitations,
    shipments,
    collaborations,
    counters: {
      kol: kols.length,
      invitation: invitations.length,
      shipment: shipments.length,
      collaboration: collaborations.length,
      product: products.length,
    },
  }
}

let state: DemoState | null = null

function loadState(): DemoState {
  if (state) return state

  if (canUseStorage()) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        state = JSON.parse(raw) as DemoState
        if (!Array.isArray(state.products)) {
          const seeded = createInitialState()
          state.products = seeded.products
          state.counters = { ...seeded.counters, ...state.counters, product: seeded.products.length }
          saveState()
        }
        if (!state.counters.product) {
          state.counters.product = state.products.length
          saveState()
        }
        return state
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  state = createInitialState()
  saveState()
  return state
}

function saveState() {
  if (!state || !canUseStorage()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function nextId(kind: keyof DemoCounters) {
  const current = loadState()
  current.counters[kind] += 1
  return `demo-${kind}-${String(current.counters[kind]).padStart(3, '0')}`
}

function requireRecord<T extends { id: string }>(items: T[], id: string, label: string): T {
  const record = items.find(item => item.id === id)
  if (!record) throw new Error(`${label} 不存在或已被删除`)
  return record
}

export const demoDatabase = {
  getProducts(): Product[] {
    return clone([...loadState().products].sort((a, b) => {
      const priority = (b.priority || 0) - (a.priority || 0)
      return priority !== 0 ? priority : a.name.localeCompare(b.name)
    }))
  },

  createProduct(product: Partial<Product> & Pick<Product, 'name'>): Product {
    const current = loadState()
    const createdAt = nowISO()
    const record: Product = {
      id: nextId('product'),
      name: product.name.trim(),
      category: product.category?.trim() || '',
      target_kol_tags: Array.isArray(product.target_kol_tags) ? product.target_kol_tags : [],
      target_content_shapes: Array.isArray(product.target_content_shapes) ? product.target_content_shapes : [],
      status: product.status || '在推',
      priority: Number.isFinite(Number(product.priority)) ? Number(product.priority) : 0,
      notes: product.notes?.trim() || '',
      created_at: createdAt,
      updated_at: createdAt,
    }

    current.products.unshift(record)
    saveState()
    return clone(record)
  },

  updateProduct(id: string, updates: Partial<Product>): Product {
    const current = loadState()
    const record = requireRecord(current.products, id, '产品')
    Object.assign(record, updates, { updated_at: nowISO() })
    saveState()
    return clone(record)
  },

  deleteProduct(id: string): void {
    const current = loadState()
    current.products = current.products.filter(product => product.id !== id)
    saveState()
  },

  getKOLs(): KOL[] {
    return clone(sortByDateDesc(loadState().kols, kol => kol.created_at))
  },

  createKOL(kol: Partial<KOL> & Pick<KOL, 'name'>): KOL {
    const current = loadState()
    const createdAt = nowISO()
    const record: KOL = {
      id: nextId('kol'),
      name: kol.name.trim(),
      email: kol.email?.trim() || '',
      homepage_url: kol.homepage_url?.trim() || '',
      platform: kol.platform || '',
      followers: kol.followers?.trim() || '',
      country: kol.country?.trim() || '',
      tags: Array.isArray(kol.tags) ? kol.tags : [],
      notes: kol.notes?.trim() || '',
      blacklisted_at: kol.blacklisted_at || null,
      blacklist_reason: kol.blacklist_reason?.trim() || '',
      status: kol.status || '未首触',
      sample_product: kol.sample_product?.trim() || '',
      sample_date: kol.sample_date || null,
      tracking_number: kol.tracking_number?.trim() || '',
      shipping_details: kol.shipping_details?.trim() || '',
      created_at: createdAt,
      updated_at: createdAt,
    }

    current.kols.unshift(record)
    saveState()
    return clone(record)
  },

  updateKOL(id: string, updates: Partial<KOL>): KOL {
    const current = loadState()
    const record = requireRecord(current.kols, id, 'KOL')
    Object.assign(record, updates, { updated_at: nowISO() })
    saveState()
    return clone(record)
  },

  deleteKOL(id: string): void {
    const current = loadState()
    current.kols = current.kols.filter(kol => kol.id !== id)
    current.invitations = current.invitations.filter(invitation => invitation.kol_id !== id)
    current.shipments = current.shipments.filter(shipment => shipment.kol_id !== id)
    current.collaborations = current.collaborations.filter(collaboration => collaboration.kol_id !== id)
    saveState()
  },

  getInvitationsByKOL(kolId: string): Invitation[] {
    return clone(sortByDateDesc(
      loadState().invitations.filter(invitation => invitation.kol_id === kolId),
      invitation => invitation.invited_at
    ))
  },

  getInvitations(): Invitation[] {
    return clone(sortByDateDesc(loadState().invitations, invitation => invitation.invited_at))
  },

  createInvitation(invitation: Partial<Invitation> & Pick<Invitation, 'kol_id' | 'product'>): Invitation {
    const current = loadState()
    const record: Invitation = {
      id: nextId('invitation'),
      created_at: new Date().toISOString(),
      kol_id: invitation.kol_id,
      product: invitation.product?.trim() || '',
      invited_at: invitation.invited_at || new Date().toISOString().slice(0, 10),
      email_subject: invitation.email_subject?.trim() || '',
      replied: Boolean(invitation.replied),
      reply_result: invitation.reply_result || '未回复',
      quoted_fee: invitation.quoted_fee?.trim() || '',
      decision: invitation.decision || '待评估',
      decision_reason: invitation.decision_reason?.trim() || '',
      notes: invitation.notes?.trim() || '',
    }

    current.invitations.unshift(record)
    saveState()
    return clone(record)
  },

  updateInvitation(id: string, updates: Partial<Invitation>): Invitation {
    const current = loadState()
    const record = requireRecord(current.invitations, id, '邀约记录')
    Object.assign(record, updates)
    saveState()
    return clone(record)
  },

  deleteInvitation(id: string): void {
    const current = loadState()
    current.invitations = current.invitations.filter(invitation => invitation.id !== id)
    saveState()
  },

  getShipments(): Shipment[] {
    return clone(sortByDateDesc(loadState().shipments, shipment => shipment.created_at))
  },

  getShipmentsByKOL(kolId: string): Shipment[] {
    return clone(sortByDateDesc(
      loadState().shipments.filter(shipment => shipment.kol_id === kolId),
      shipment => shipment.created_at
    ))
  },

  createShipment(shipment: Partial<Shipment> & Pick<Shipment, 'kol_id' | 'product'>): Shipment {
    const current = loadState()
    const createdAt = nowISO()
    const record: Shipment = {
      id: nextId('shipment'),
      kol_id: shipment.kol_id,
      source_invitation_id: shipment.source_invitation_id?.trim() || null,
      product: shipment.product?.trim() || '',
      sample_date: shipment.sample_date || null,
      tracking_number: shipment.tracking_number?.trim() || '',
      shipping_details: shipment.shipping_details?.trim() || '',
      status: shipment.status || '待寄出',
      notes: shipment.notes?.trim() || '',
      delivered_at: shipment.delivered_at || null,
      progress_status: shipment.progress_status || '待制作',
      progress_notes: shipment.progress_notes?.trim() || '',
      expected_publish_date: shipment.expected_publish_date || null,
      completed_at: shipment.completed_at || null,
      archived_at: shipment.archived_at || null,
      created_at: createdAt,
      updated_at: createdAt,
    }

    current.shipments.unshift(record)
    saveState()
    return clone(record)
  },

  updateShipment(id: string, updates: Partial<Shipment>): Shipment {
    const current = loadState()
    const record = requireRecord(current.shipments, id, '寄样记录')
    Object.assign(record, updates, { updated_at: nowISO() })
    saveState()
    return clone(record)
  },

  deleteShipment(id: string): void {
    const current = loadState()
    current.shipments = current.shipments.filter(shipment => shipment.id !== id)
    saveState()
  },

  getCollaborations(): Collaboration[] {
    return clone(sortCollaborations(loadState().collaborations))
  },

  getCollaborationsByKOL(kolId: string): Collaboration[] {
    return clone(sortCollaborations(loadState().collaborations.filter(collaboration => collaboration.kol_id === kolId)))
  },

  createCollaboration(collaboration: Partial<Collaboration> & Pick<Collaboration, 'kol_id' | 'product'>): Collaboration {
    const current = loadState()
    const record: Collaboration = {
      id: nextId('collaboration'),
      kol_id: collaboration.kol_id,
      shipment_id: collaboration.shipment_id?.trim() || null,
      product: collaboration.product?.trim() || '',
      publish_date: collaboration.publish_date || null,
      work_url: collaboration.work_url?.trim() || '',
      views: collaboration.views ?? null,
      comments: collaboration.comments ?? null,
      likes: collaboration.likes ?? null,
      fee: collaboration.fee?.trim() || '',
      notes: collaboration.notes?.trim() || '',
    }

    current.collaborations.unshift(record)
    saveState()
    return clone(record)
  },

  updateCollaboration(id: string, updates: Partial<Collaboration>): Collaboration {
    const current = loadState()
    const record = requireRecord(current.collaborations, id, '合作记录')
    Object.assign(record, updates)
    saveState()
    return clone(record)
  },

  deleteCollaboration(id: string): void {
    const current = loadState()
    current.collaborations = current.collaborations.filter(collaboration => collaboration.id !== id)
    saveState()
  },
}
