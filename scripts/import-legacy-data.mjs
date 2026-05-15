import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const rootDir = 'C:/Users/Administrator/WorkBuddy/2026-05-12-task-2'
const outDir = path.join(rootDir, 'migration-output')
const envPath = path.join(rootDir, '.env.local')
const reportPath = path.join(outDir, 'legacy-import-result.json')

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

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') {
        row.push(cell)
        cell = ''
      } else if (ch === '\n') {
        row.push(cell)
        rows.push(row)
        row = []
        cell = ''
      } else if (ch !== '\r') {
        cell += ch
      }
    }
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const headers = rows.shift() || []
  return rows.filter(r => r.some(Boolean)).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] || ''])))
}

function nullIfEmpty(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '未寄样') return null
  return text
}

function dateOrNull(value) {
  const text = nullIfEmpty(value)
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function numberOrNull(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const num = Number(text.replace(/,/g, ''))
  return Number.isFinite(num) ? Math.round(num) : null
}

function tagsArray(value) {
  return String(value || '').split('|').map(t => t.trim()).filter(Boolean)
}

function uniqByLegacyKey(rows) {
  const seen = new Set()
  const result = []
  for (const row of rows) {
    const key = row.legacy_key
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

async function clearLegacyData(supabase) {
  await supabase.from('emails').delete().not('id', 'is', null)
  await supabase.from('invitations').delete().not('id', 'is', null)
  await supabase.from('collaborations').delete().not('id', 'is', null)
  await supabase.from('shipments').delete().not('id', 'is', null)
  await supabase.from('kols').delete().not('id', 'is', null)
}

async function insertInBatches(supabase, table, rows, size = 100) {
  const inserted = []
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size)
    const { data, error } = await supabase.from(table).insert(batch).select('*')
    if (error) throw new Error(`${table} insert failed: ${error.message}`)
    inserted.push(...(data || []))
  }
  return inserted
}

async function main() {
  const env = parseEnv(envPath)
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env config')

  const supabase = createClient(url, key)
  const kolsCsv = parseCsv(fs.readFileSync(path.join(outDir, 'clean_kols.csv'), 'utf8'))
  const shipmentsCsv = parseCsv(fs.readFileSync(path.join(outDir, 'clean_shipments.csv'), 'utf8'))
  const collaborationsCsv = parseCsv(fs.readFileSync(path.join(outDir, 'clean_collaborations.csv'), 'utf8'))

  const legacyKols = uniqByLegacyKey(kolsCsv)
  const kolsPayload = legacyKols.map(row => ({
    name: row.name || row.legacy_key,
    email: nullIfEmpty(row.email),
    homepage_url: nullIfEmpty(row.homepage_url),
    platform: nullIfEmpty(row.platform),
    followers: nullIfEmpty(row.followers),
    country: nullIfEmpty(row.country),
    tags: tagsArray(row.tags),
    status: row.status || '未首触',
    sample_date: dateOrNull(row.sample_date),
    tracking_number: nullIfEmpty(row.tracking_number),
    shipping_details: nullIfEmpty(row.shipping_details),
  }))

  await clearLegacyData(supabase)
  const insertedKols = await insertInBatches(supabase, 'kols', kolsPayload)
  const idByLegacyKey = new Map()
  legacyKols.forEach((row, index) => idByLegacyKey.set(row.legacy_key, insertedKols[index]?.id))

  const shipmentsPayload = shipmentsCsv.map(row => ({
    kol_id: idByLegacyKey.get(row.legacy_kol_key),
    product: row.product,
    sample_date: dateOrNull(row.sample_date),
    tracking_number: nullIfEmpty(row.tracking_number),
    shipping_details: nullIfEmpty(row.shipping_details),
    status: row.status || '待寄出',
    notes: nullIfEmpty([row.notes, row.raw_logistics_status ? `原物流状态：${row.raw_logistics_status}` : '', row.review_note].filter(Boolean).join('\n')),
    delivered_at: dateOrNull(row.delivered_at),
  })).filter(row => row.kol_id && row.product)

  const collaborationsPayload = collaborationsCsv.map(row => ({
    kol_id: idByLegacyKey.get(row.legacy_kol_key),
    product: nullIfEmpty(row.product),
    publish_date: dateOrNull(row.publish_date),
    work_url: nullIfEmpty(row.post_url),
    views: numberOrNull(row.views),
    comments: numberOrNull(row.comments),
    likes: numberOrNull(row.likes),
    fee: nullIfEmpty(row.fee),
    notes: nullIfEmpty([row.notes, row.review_note].filter(Boolean).join('\n')),
  })).filter(row => row.kol_id && (row.product || row.work_url || row.views || row.comments || row.notes))

  const insertedShipments = await insertInBatches(supabase, 'shipments', shipmentsPayload)
  const insertedCollaborations = await insertInBatches(supabase, 'collaborations', collaborationsPayload)

  const report = {
    importedAt: new Date().toISOString(),
    sourceDir: outDir,
    counts: {
      kols: insertedKols.length,
      shipments: insertedShipments.length,
      collaborations: insertedCollaborations.length,
    },
    skipped: {
      shipments: shipmentsCsv.length - shipmentsPayload.length,
      collaborations: collaborationsCsv.length - collaborationsPayload.length,
    },
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
