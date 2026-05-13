export interface KOL {
  id: string
  name: string
  email: string
  homepage_url: string
  platform: string
  followers: string
  country: string
  tags: string[]
  status: string
  sample_product: string
  sample_date: string | null
  tracking_number: string
  shipping_details: string
  created_at: string
  updated_at: string
}

export interface Invitation {
  id: string
  kol_id: string
  product: string
  invited_at: string
  email_subject: string
  replied: boolean
  reply_result: string
  notes: string
}

export interface Collaboration {
  id: string
  kol_id: string
  product: string
  cooperation_date: string
  publish_date: string | null
  work_url: string
  views: number | null
  comments: number | null
  likes: number | null
  fee: string
  notes: string
}

export interface Shipment {
  id: string
  kol_id: string
  product: string
  sample_date: string | null
  tracking_number: string
  shipping_details: string
  status: string
  notes: string
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export interface Email {
  id: string
  kol_id: string
  kol_email: string
  direction: 'inbound' | 'outbound'
  from_address: string
  to_address: string
  subject: string
  body: string
  sent_at: string
  message_id: string
}

export const PLATFORMS = ['YouTube', 'TikTok', 'X', 'Blog', 'Forum', 'Instagram']
export const STATUSES = ['未首触', '已邀约', '待寄出', '运输中', '已签收', '合作完成', '拒绝合作', '未回复']
export const SHIPMENT_STATUSES = ['待寄出', '运输中', '已签收']
export const PRODUCTS = ['BY53', 'BY54', 'K1', 'X1s', 'N1', 'Z1']
export const TAGS = ['SBC', 'NAS', 'AI', 'Robotics', 'Smart Home', 'Networking', 'Storage']
export const REPLY_RESULTS = ['同意合作', '拒绝合作', '未回复', '考虑中']
