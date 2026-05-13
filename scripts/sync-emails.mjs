/**
 * IMAP 邮件同步脚本
 * 从企业邮箱拉取邮件，匹配 KOL 邮箱后写入 Supabase emails 表
 *
 * 使用方式: node scripts/sync-emails.mjs
 * 依赖: npm install imapflow mailparser dotenv @supabase/supabase-js
 */

import 'dotenv/config'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createClient } from '@supabase/supabase-js'

// ─── Config ───────────────────────────────────────────────────────────────────
const IMAP_HOST = process.env.IMAP_HOST || 'imap.qiye.aliyun.com'
const IMAP_PORT = Number(process.env.IMAP_PORT) || 993
const EMAIL_USER = process.env.EMAIL_USER
const EMAIL_PASS = process.env.EMAIL_PASS
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!EMAIL_USER || !EMAIL_PASS || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 缺少环境变量，请检查 .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getKolEmails() {
  const { data, error } = await supabase.from('kols').select('id, email')
  if (error) throw error
  // Build a map: email (lowercase) -> kol_id
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📬 开始同步邮件...')

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

  // Sync INBOX (inbound) and Sent (outbound)
  const folders = [
    { path: 'INBOX', direction: 'inbound' },
    { path: 'Sent Messages', direction: 'outbound' },
    { path: 'INBOX.Sent', direction: 'outbound' },
  ]

  let synced = 0

  for (const folder of folders) {
    try {
      const lock = await client.getMailboxLock(folder.path)
      try {
        // Fetch last 90 days
        const since = new Date()
        since.setDate(since.getDate() - 90)

        const messages = client.fetch({ since }, { source: true, envelope: true })

        for await (const msg of messages) {
          const messageId = msg.envelope?.messageId || ''
          if (!messageId || existingIds.has(messageId)) continue

          const parsed = await simpleParser(msg.source)
          const from = parsed.from?.value?.[0]?.address?.toLowerCase() || ''
          const toList = (parsed.to?.value || []).map(a => a.address?.toLowerCase() || '')

          // Match against KOL emails
          let kolId = null
          let kolEmail = null

          if (folder.direction === 'inbound') {
            // Inbound: from = KOL
            if (kolMap.has(from)) {
              kolId = kolMap.get(from)
              kolEmail = from
            }
          } else {
            // Outbound: to = KOL
            for (const to of toList) {
              if (kolMap.has(to)) {
                kolId = kolMap.get(to)
                kolEmail = to
                break
              }
            }
          }

          if (!kolId) continue

          const emailRecord = {
            kol_id: kolId,
            kol_email: kolEmail,
            direction: folder.direction,
            from_address: from,
            to_address: toList[0] || '',
            subject: parsed.subject || '(无主题)',
            body: (parsed.text || '').slice(0, 5000),
            sent_at: (parsed.date || new Date()).toISOString(),
            message_id: messageId,
          }

          const { error } = await supabase.from('emails').insert([emailRecord])
          if (!error) {
            synced++
            existingIds.add(messageId)
          }
        }
      } finally {
        lock.release()
      }
    } catch (e) {
      // Folder might not exist, skip
      console.log(`  ⚠️ 跳过文件夹 ${folder.path}: ${e.message}`)
    }
  }

  await client.logout()
  console.log(`✅ 同步完成，新增 ${synced} 封邮件`)
}

main().catch(err => {
  console.error('❌ 同步失败:', err.message)
  process.exit(1)
})
