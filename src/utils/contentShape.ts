import type { KOL } from '../types'

export type ContentShape = '视频' | '网站'

export interface ContentShapeMetricLabels {
  views: string
  viewsInput: string
  totalViews: string
  likes: string
  likesInput: string
  totalLikes: string
  comments: string
  commentsInput: string
}

const websitePlatforms = new Set(['blog', 'forum', '网站', 'website', 'site', 'web'])

export const CONTENT_SHAPES: ContentShape[] = ['视频', '网站']

export function getPlatformContentShape(platform?: string | null): ContentShape {
  const normalized = String(platform || '').trim().toLowerCase()
  if (!normalized) return '视频'
  if (websitePlatforms.has(normalized)) return '网站'
  if (/^https?:\/\//.test(normalized) || normalized.includes('www.')) return '网站'
  return '视频'
}

export function getKolContentShape(kol?: Pick<KOL, 'platform'> | null): ContentShape {
  return getPlatformContentShape(kol?.platform)
}

export function getContentShapeMetricLabels(shape: ContentShape): ContentShapeMetricLabels {
  if (shape === '网站') {
    return {
      views: '访问/阅读',
      viewsInput: '访问/阅读量',
      totalViews: '总访问/阅读',
      likes: '互动',
      likesInput: '互动数',
      totalLikes: '总互动',
      comments: '评论',
      commentsInput: '评论数',
    }
  }

  return {
    views: '播放',
    viewsInput: '播放量',
    totalViews: '总播放',
    likes: '点赞',
    likesInput: '点赞数',
    totalLikes: '总点赞',
    comments: '评论',
    commentsInput: '评论数',
  }
}
