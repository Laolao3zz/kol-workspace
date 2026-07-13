import { describe, expect, it } from 'vitest'
import {
  createCollaboration,
  deleteCollaboration,
  getCollaborationsByKOL,
  saveCollaborationForShipment,
} from './collaborationService'

const collaboration = (workUrl: string) => ({
  kol_id: 'demo-kol-001',
  product: 'K1',
  publish_date: '2026-07-13',
  work_url: workUrl,
  views: null,
  comments: null,
  likes: null,
  fee: '',
  notes: '',
})

describe('collaborationService external URLs', () => {
  it('normalizes a host-like work URL before saving', async () => {
    const created = await createCollaboration(collaboration('youtube.com/watch?v=work'))

    try {
      expect(created.work_url).toBe('https://youtube.com/watch?v=work')
    } finally {
      await deleteCollaboration(created.id)
    }
  })

  it('rejects non-HTTP work URL protocols', async () => {
    await expect(createCollaboration(collaboration('javascript:alert(1)')))
      .rejects.toThrow('作品链接必须是有效的 HTTP/HTTPS 地址')
  })

  it('coalesces concurrent archive saves for the same shipment', async () => {
    const shipmentId = `shipment-${Date.now()}-archive`
    const firstPayload = {
      ...collaboration('youtube.com/watch?v=first'),
      shipment_id: shipmentId,
      notes: 'first archive',
    }
    const secondPayload = {
      ...collaboration('youtube.com/watch?v=second'),
      shipment_id: shipmentId,
      notes: 'second archive',
    }

    const saved = await Promise.all([
      saveCollaborationForShipment(firstPayload),
      saveCollaborationForShipment(secondPayload),
    ])

    try {
      const stored = (await getCollaborationsByKOL('demo-kol-001'))
        .filter(item => item.shipment_id === shipmentId)
      expect(stored).toHaveLength(1)
      expect(new Set(saved.map(item => item.id)).size).toBe(1)
    } finally {
      await Promise.all([...new Set(saved.map(item => item.id))].map(deleteCollaboration))
    }
  })
})
