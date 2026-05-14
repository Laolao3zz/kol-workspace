/**
 * IMAP 邮件同步脚本
 * 从企业邮箱拉取邮件，匹配 KOL 邮箱后写入 Supabase emails 表
 *
 * 使用方式: node --env-file=.env.local scripts/sync-emails.mjs
 */

import 'dotenv/config'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createClient } from '@supabase/supabase-js'

const IMAP_HOST = process.env.IMAP_HOST || 'imap.qiye.aliyun.com'
const IMAP_PORT = Number(process.env.IMAP_PORT) || 993
const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_PASS = process.env.EMAIL_PASS
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY
const DAYS = Number(process.env.EMAIL_SYNC_DAYS || 90)

const splitFolders = (value, fallback) => (value || fallback)
  .split(',')
  .map(item => item.trim())
  .filter(Boolean)

const INBOX_FOLDERS = splitFolders(process.env.EMAIL_INBOX_FOLDERS, 'INBOX')
const SENT_FOLDERS = splitFolders(process.env.EMAIL_SENT_FOLDERS, 'Sent Messages,INBOX.Sent,Sent,已发送,已发送邮件')

if (!EMAIL_USER || !EMAIL_PASS || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 缺少环境变量，请检查 .env.local')
  console.error('   必需: EMAIL_USER, EMAIL_PASS, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function getKolEmails() {
  const { data, error } = await supabase.from('kols').select('id, email')
  if (error) throw error
  const map = new Map()
  for (const kol of data) {
    if (kol.email) map.set(kol.email.toLowerCase(), kol.id)
  }
  return map
}

async function getExistingMessageIds() {
  const { data, error } = await supabase.from('emails').select('message_id')
  if (error) throw error
  return new Set(data.map(e => e.message_id))
}

async function listMailboxes(client) {
  const boxes = []
  for await (const box of client.list()) {
    boxes.push(box.path)
  }
  return boxes
}

async function main() {
  console.log('📬 开始同步邮件...')
  console.log(`  IMAP: ${IMAP_HOST}:${IMAP_PORT}`)
  console.log(`  用户: ${EMAIL_USER}`)
  console.log(`  扫描范围: 最近 ${DAYS} 天`)

  const kolMap = await getKolEmails()
  const existingIds = await getExistingMessageIds()

  console.log(`  已知 KOL 邮箱: ${kolMap.size} 个`)
  console.log(`  已存邮件: ${existingIds.size} 封`)

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    logger: false,
  })

  await client.connect()
  console.log('  ✅ IMAP 连接成功')

  const mailboxes = await listMailboxes(client)
  console.log(`  可用邮箱文件夹: ${mailboxes.join(' | ') || '未读取到'}`)

  const folders = [
    ...INBOX_FOLDERS.map(path => ({ path, direction: 'inbound' })),
    ...SENT_FOLDERS.map(path => ({ path, direction: 'outbound' })),
  ]

  let scanned = 0
  let matched = 0
  let skippedDuplicate = 0
  let skippedUnmatched = 0
  let insertFailed = 0
  let synced = 0

  for (const folder of folders) {
    try {
      console.log(`  🔎 扫描文件夹 ${folder.path} (${folder.direction})`)
      const lock = await client.getMailboxLock(folder.path)
      let folderScanned = 0
      let folderMatched = 0
      try {
        const since = new Date()
        since.setDate(since.getDate() - DAYS)

        const messages = client.fetch({ since }, { source: true, envelope: true })

        for await (const msg of messages) {
          scanned++
          folderScanned++
          const messageId = msg.envelope?.messageId || ''
          if (!messageId || existingIds.has(messageId)) {
            skippedDuplicate++
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
            skippedUnmatched++
            continue
          }

          matched++
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
            synced++
            existingIds.add(messageId)
          } else {
            insertFailed++
            console.log(`    ⚠️ 写入失败: ${error.message}`)
          }
        }
      } finally {
        lock.release()
      }
      console.log(`    扫描 ${folderScanned} 封，匹配 ${folderMatched} 封`)
    } catch (e) {
      console.log(`  ⚠️ 跳过文件夹 ${folder.path}: ${e.message}`)
    }
  }

  await client.logout()
  console.log('✅ 同步完成')
  console.log(`  扫描: ${scanned} 封`)
  console.log(`  匹配 KOL: ${matched} 封`)
  console.log(`  新增写入: ${synced} 封`)
  console.log(`  跳过重复/无ID: ${skippedDuplicate} 封`)
  console.log(`  跳过未匹配: ${skippedUnmatched} 封`)
  console.log(`  写入失败: ${insertFailed} 封`)
}

main().catch(err => {
  console.error('❌ 同步失败:', err.message)
  process.exit(1)
})
