/**
 * 邮件同步核心逻辑
 * 被 scripts/sync-emails.mjs（CLI）和 api/sync-emails.mjs（Vercel Cron）共用
 */

import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createClient } from '@supabase/supabase-js'

const splitFolders = (value, fallback) => (value || fallback)
  .split(',')
  .map(item => item.trim())
  .filter(Boolean)

export async function runEmailSync({ logger = console } = {}) {
  const IMAP_HOST = process.env.IMAP_HOST || 'imap.qiye.aliyun.com'
  const IMAP_PORT = Number(process.env.IMAP_PORT) || 993
  const EMAIL_USER = process.env.EMAIL_USER
  const EMAIL_PASS = process.env.EMAIL_PASS
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
  const DAYS = Number(process.env.EMAIL_SYNC_DAYS || 90)
  const INBOX_FOLDERS = splitFolders(process.env.EMAIL_INBOX_FOLDERS, 'INBOX')
  const SENT_FOLDERS = splitFolders(
    process.env.EMAIL_SENT_FOLDERS,
    'Sent Messages,INBOX.Sent,Sent,已发送,已发送邮件',
  )

  const missing = []
  if (!EMAIL_USER) missing.push('EMAIL_USER')
  if (!EMAIL_PASS) missing.push('EMAIL_PASS')
  if (!SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
  if (!SUPABASE_KEY) missing.push('VITE_SUPABASE_ANON_KEY')
  if (missing.length > 0) {
    throw new Error(`缺少环境变量: ${missing.join(', ')}`)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  logger.log('📬 开始同步邮件...')
  logger.log(`  IMAP: ${IMAP_HOST}:${IMAP_PORT}`)
  logger.log(`  用户: ${EMAIL_USER}`)
  logger.log(`  扫描范围: 最近 ${DAYS} 天`)

  const kolMap = await getKolEmails(supabase)
  const existingIds = await getExistingMessageIds(supabase)

  logger.log(`  已知 KOL 邮箱: ${kolMap.size} 个`)
  logger.log(`  已存邮件: ${existingIds.size} 封`)

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    logger: false,
  })

  const stats = {
    scanned: 0,
    matched: 0,
    synced: 0,
    skippedDuplicate: 0,
    skippedUnmatched: 0,
    insertFailed: 0,
    folders: [],
  }

  await client.connect()
  logger.log('  ✅ IMAP 连接成功')

  try {
    const folders = [
      ...INBOX_FOLDERS.map(path => ({ path, direction: 'inbound' })),
      ...SENT_FOLDERS.map(path => ({ path, direction: 'outbound' })),
    ]

    for (const folder of folders) {
      await processFolder({
        client,
        supabase,
        folder,
        kolMap,
        existingIds,
        days: DAYS,
        stats,
        logger,
      })
    }
  } finally {
    await client.logout().catch(() => {})
  }

  logger.log('✅ 同步完成')
  logger.log(`  扫描: ${stats.scanned} 封`)
  logger.log(`  匹配 KOL: ${stats.matched} 封`)
  logger.log(`  新增写入: ${stats.synced} 封`)
  logger.log(`  跳过重复/无ID: ${stats.skippedDuplicate} 封`)
  logger.log(`  跳过未匹配: ${stats.skippedUnmatched} 封`)
  logger.log(`  写入失败: ${stats.insertFailed} 封`)

  return stats
}

async function getKolEmails(supabase) {
  const { data, error } = await supabase.from('kols').select('id, email')
  if (error) throw error
  const map = new Map()
  for (const kol of data) {
    if (kol.email) map.set(kol.email.toLowerCase(), kol.id)
  }
  return map
}

async function getExistingMessageIds(supabase) {
  const { data, error } = await supabase.from('emails').select('message_id')
  if (error) throw error
  return new Set(data.map(e => e.message_id))
}

async function processFolder({ client, supabase, folder, kolMap, existingIds, days, stats, logger }) {
  let folderScanned = 0
  let folderMatched = 0
  try {
    logger.log(`  🔎 扫描文件夹 ${folder.path} (${folder.direction})`)
    const lock = await client.getMailboxLock(folder.path)
    try {
      const since = new Date()
      since.setDate(since.getDate() - days)

      const messages = client.fetch({ since }, { source: true, envelope: true })

      for await (const msg of messages) {
        stats.scanned++
        folderScanned++
        const messageId = msg.envelope?.messageId || ''
        if (!messageId || existingIds.has(messageId)) {
          stats.skippedDuplicate++
          continue
        }

        const parsed = await simpleParser(msg.source)
        const from = parsed.from?.value?.[0]?.address?.toLowerCase() || ''
        const toList = (parsed.to?.value || []).map(a => a.address?.toLowerCase() || '')

        let kolId = null
        let kolEmail = null

        if (folder.direction === 'inbound') {
          if (kolMap.has(from)) {
            kolId = kolMap.get(from)
            kolEmail = from
          }
        } else {
          for (const to of toList) {
            if (kolMap.has(to)) {
              kolId = kolMap.get(to)
              kolEmail = to
              break
            }
          }
        }

        if (!kolId) {
          stats.skippedUnmatched++
          continue
        }

        stats.matched++
        folderMatched++

        const emailRecord = {
          kol_id: kolId,
          kol_email: kolEmail,
          direction: folder.direction,
          from_address: from,
          to_address: toList.join(', '),
          subject: parsed.subject || '(无主题)',
          body: (parsed.text || '').slice(0, 5000),
          sent_at: (parsed.date || new Date()).toISOString(),
          message_id: messageId,
        }

        const { error } = await supabase.from('emails').insert([emailRecord])
        if (!error) {
          stats.synced++
          existingIds.add(messageId)
        } else {
          stats.insertFailed++
          logger.log(`    ⚠️ 写入失败: ${error.message}`)
        }
      }
    } finally {
      lock.release()
    }
    stats.folders.push({ path: folder.path, scanned: folderScanned, matched: folderMatched })
    logger.log(`    扫描 ${folderScanned} 封，匹配 ${folderMatched} 封`)
  } catch (e) {
    logger.log(`  ⚠️ 跳过文件夹 ${folder.path}: ${e.message}`)
    stats.folders.push({ path: folder.path, error: e.message })
  }
}
