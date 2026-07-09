import { describe, expect, it } from 'vitest'
import { getContentShapeMetricLabels, getKolContentShape, getPlatformContentShape } from './contentShape'

describe('content shape helpers', () => {
  it('maps known editorial websites to website content shape', () => {
    expect(getPlatformContentShape('Blog')).toBe('网站')
    expect(getPlatformContentShape('Forum')).toBe('网站')
    expect(getPlatformContentShape('网站')).toBe('网站')
    expect(getPlatformContentShape('https://example.com')).toBe('网站')
  })

  it('keeps social and video platforms in the video content shape', () => {
    expect(getPlatformContentShape('YouTube')).toBe('视频')
    expect(getPlatformContentShape('TikTok')).toBe('视频')
    expect(getPlatformContentShape('Instagram')).toBe('视频')
    expect(getPlatformContentShape('X')).toBe('视频')
  })

  it('uses website performance wording for website KOLs', () => {
    const labels = getContentShapeMetricLabels(getKolContentShape({ platform: 'Blog' }))

    expect(labels.views).toBe('访问/阅读')
    expect(labels.viewsInput).toBe('访问/阅读量')
    expect(labels.likes).toBe('互动')
    expect(labels.totalViews).toBe('总访问/阅读')
  })
})
