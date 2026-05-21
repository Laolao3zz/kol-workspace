/**
 * Vercel Serverless Function：邮件同步
 *
 * 路由：GET /api/sync-emails
 *
 * 鉴权：
 *   - 如果配置了 CRON_SECRET 环境变量，请求必须带
 *     Authorization: Bearer ${CRON_SECRET}
 *   - Vercel Cron 调用时会自动带上
 *
 * 手动触发（curl）：
 *   curl -H "Authorization: Bearer YOUR_SECRET" https://your-app.vercel.app/api/sync-emails
 */

import { runEmailSync } from './_lib/emailSync.mjs'

export const config = {
  runtime: 'nodejs',
  maxDuration: 300,
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.authorization || ''
    if (auth !== `Bearer ${cronSecret}`) {
      res.status(401).json({ ok: false, error: 'Unauthorized' })
      return
    }
  }

  const startedAt = Date.now()
  try {
    const stats = await runEmailSync()
    res.status(200).json({
      ok: true,
      durationMs: Date.now() - startedAt,
      stats,
    })
  } catch (err) {
    console.error('❌ 邮件同步失败:', err)
    res.status(500).json({
      ok: false,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
