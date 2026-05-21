/**
 * IMAP 邮件同步脚本（CLI 入口）
 * 从企业邮箱拉取邮件，匹配 KOL 邮箱后写入 Supabase emails 表
 *
 * 使用方式: node --env-file=.env.local scripts/sync-emails.mjs
 *
 * 核心逻辑在 api/_lib/emailSync.mjs，与 Vercel Cron 路由共用。
 */

import 'dotenv/config'
import { runEmailSync } from '../api/_lib/emailSync.mjs'

runEmailSync().catch(err => {
  console.error('❌ 同步失败:', err.message)
  process.exit(1)
})
