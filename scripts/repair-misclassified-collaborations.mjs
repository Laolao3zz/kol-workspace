import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const rootDir = 'C:/Users/Administrator/WorkBuddy/2026-05-12-task-2'
const envPath = path.join(rootDir, '.env.local')
const apply = process.argv.includes('--apply')
const targetProducts = ['K1', 'YY3588', 'Lora']

function parseEnv(file) {
  const env = {}
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

function text(value) {
  return String(value ?? '').trim()
}

function normalizeProduct(value) {
  return text(value).toLowerCase().replace(/\s+/g, '')
}

function isTargetProduct(product) {
  const normalized = normalizeProduct(product)
  return targetProducts.some(target => normalized === target.toLowerCase())
}

function hasRealCollaborationSignal(row) {
  return Boolean(
    text(row.cooperation_date) ||
    text(row.publish_date) ||
    text(row.work_url) ||
    Number(row.views || 0) > 0 ||
    Number(row.comments || 0) > 0 ||
    Number(row.likes || 0) > 0 ||
    text(row.fee)
  )
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

async function main() {
  const env = parseEnv(envPath)
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env config')

  const supabase = createClient(url, key)
  const { data: collaborations, error } = await supabase
    .from('collaborations')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error

  const candidates = (collaborations || []).filter(row =>
    isTargetProduct(row.product) && !hasRealCollaborationSignal(row)
  )

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    targetProducts,
    scanned: collaborations?.length || 0,
    candidates: candidates.length,
    moved: 0,
    skippedExistingInvitation: 0,
    deleted: 0,
    sample: candidates.slice(0, 20).map(row => ({
      id: row.id,
      kol_id: row.kol_id,
      product: row.product,
      notes: row.notes,
    })),
  }

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  for (const row of candidates) {
    const { data: existing, error: existingError } = await supabase
      .from('invitations')
      .select('id')
      .eq('kol_id', row.kol_id)
      .eq('product', row.product)
      .limit(1)

    if (existingError) throw existingError

    if (existing && existing.length > 0) {
      summary.skippedExistingInvitation += 1
    } else {
      const { error: insertError } = await supabase.from('invitations').insert([{
        kol_id: row.kol_id,
        product: row.product,
        invited_at: todayISO(),
        email_subject: '',
        replied: false,
        reply_result: '',
        notes: text(row.notes) || '从误分类合作历史迁移为邀约记录',
      }])
      if (insertError) throw insertError
      summary.moved += 1
    }

    const { error: deleteError } = await supabase
      .from('collaborations')
      .delete()
      .eq('id', row.id)

    if (deleteError) throw deleteError
    summary.deleted += 1
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
