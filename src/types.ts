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
  quoted_fee: string
  decision: string
  decision_reason: string
  notes: string
}

export interface Collaboration {
  id: string
  kol_id: string
  product: string
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
  progress_status: string
  progress_notes: string
  expected_publish_date: string | null
  completed_at: string | null
  archived_at: string | null
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

export const PLATFORMS = ['YouTube', 'TikTok', 'X', 'Blog', 'Forum', 'Instagram', '网站', 'Discord']
export const STATUSES = ['未首触', '已邀约', '待寄出', '运输中', '内容跟进', '合作完成', '拒绝合作', '我方拒绝', '异常']
export const SHIPMENT_STATUSES = ['待寄出', '运输中', '已签收']
export const PROGRESS_STATUSES = ['待制作', '制作中', '待发布', '已完成', '暂停/异常']
export const PRODUCTS = ['BY53', 'BY54', 'YY3588', 'R1', 'X1', 'X1s', 'K1', 'N1', 'Z1', 'NAS', 'Lora']
export const TAGS = ['SBC', '科技', 'NAS', '户外装备', '无线电', 'Mini PC', 'AI', 'Robotics', 'Smart Home', 'Networking', 'Storage']
export const REPLY_RESULTS = ['同意合作', '拒绝合作', '未回复']
export const INVITATION_DECISIONS = ['待评估', '继续推进', '我方拒绝']
export const DECISION_REASONS = ['报价过高', '产品不匹配', '档期不合适', '暂缓推进']
