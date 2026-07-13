import { describe, expect, it, vi } from 'vitest'
import { runPostPersistWorkflow } from './persistedWrite'

describe('runPostPersistWorkflow', () => {
  it('runs recovery refreshes and reports partial success after a workflow failure', async () => {
    const workflowError = new Error('shipment sync failed')
    const refreshInvitation = vi.fn(async () => undefined)
    const refreshShipment = vi.fn(async () => undefined)

    const result = await runPostPersistWorkflow(
      [async () => { throw workflowError }],
      [refreshInvitation, refreshShipment]
    )

    expect(result).toEqual({ completed: false, error: workflowError })
    expect(refreshInvitation).toHaveBeenCalledOnce()
    expect(refreshShipment).toHaveBeenCalledOnce()
  })

  it('does not run recovery refreshes when all follow-up tasks succeed', async () => {
    const recovery = vi.fn(async () => undefined)
    const first = vi.fn(async () => undefined)
    const second = vi.fn(async () => undefined)

    const result = await runPostPersistWorkflow([first, second], [recovery])

    expect(result).toEqual({ completed: true })
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
    expect(recovery).not.toHaveBeenCalled()
  })
})
