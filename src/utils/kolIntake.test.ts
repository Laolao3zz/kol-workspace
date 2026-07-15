import { describe, expect, it } from 'vitest'
import { extractKolIntakeUrls } from './kolIntake'

describe('extractKolIntakeUrls', () => {
  it('extracts links from markdown and arbitrary AI output', () => {
    expect(extractKolIntakeUrls(`
      1. [Creator Lab](https://youtube.com/@CreatorLab/videos)
      - TikTok：https://www.tiktok.com/@maker/video/123，值得关注
      官网 www.example.com/about
    `)).toEqual([
      'https://youtube.com/@CreatorLab/videos',
      'https://www.tiktok.com/@maker/video/123',
      'www.example.com/about',
    ])
  })

  it('deduplicates profile subpages using normalized account identity', () => {
    expect(extractKolIntakeUrls(`
      https://youtube.com/@CreatorLab/videos
      https://www.youtube.com/@creatorlab/about
      https://youtube.com/@AnotherCreator
    `)).toEqual([
      'https://youtube.com/@CreatorLab/videos',
      'https://youtube.com/@AnotherCreator',
    ])
  })

  it('keeps different unresolved content links as separate candidates', () => {
    expect(extractKolIntakeUrls(`
      https://youtube.com/watch?v=video-one
      https://youtube.com/watch?v=video-two
    `)).toHaveLength(2)
  })
})
