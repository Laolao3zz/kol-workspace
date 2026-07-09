export interface ShipmentSubmitInput {
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
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export function buildShipmentSubmitPayload(
  form: ShipmentSubmitInput,
  today = todayISO()
): ShipmentSubmitInput {
  const product = form.product.trim()
  const tracking = form.tracking_number.trim()
  const status = form.status === '已签收' ? '已签收' : tracking ? '运输中' : '待寄出'
  const deliveredAt = status === '已签收' ? (form.delivered_at || today) : null

  return {
    ...form,
    product,
    sample_date: form.sample_date || null,
    tracking_number: tracking,
    shipping_details: form.shipping_details.trim(),
    notes: form.notes.trim(),
    delivered_at: deliveredAt,
    expected_publish_date: form.expected_publish_date || null,
    completed_at: form.completed_at || null,
    progress_notes: form.progress_notes.trim(),
    status,
  }
}
