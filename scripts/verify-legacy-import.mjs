import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const rootDir = 'C:/Users/Administrator/WorkBuddy/2026-05-12-task-2'
const envPath = path.join(rootDir, '.env.local')

function parseEnv(file) {
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1)
  }
  return env
}

const env = parseEnv(envPath)
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const tables = ['kols', 'shipments', 'collaborations']
const counts = {}
for (const table of tables) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw error
  counts[table] = count
}

const { data: tagRows, error: tagError } = await supabase.from('kols').select('tags')
if (tagError) throw tagError
const tagCount = {}
for (const row of tagRows || []) {
  for (const tag of row.tags || []) tagCount[tag] = (tagCount[tag] || 0) + 1
}

const { data: sampleShipments, error: shipmentError } = await supabase
  .from('shipments')
  .select('product,status,notes,kols(name)')
  .order('sample_date', { ascending: true })
  .limit(15)
if (shipmentError) throw shipmentError

console.log(JSON.stringify({ counts, tagCount, sampleShipments }, null, 2))
