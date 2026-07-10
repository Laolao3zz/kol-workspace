#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import * as dotenv from 'dotenv'
import { getSupabaseTarget, requireMatchingProjectRef } from './product-alias-repair-config.mjs'
import { runProductAliasRepair } from './product-alias-repair-runner.mjs'

const apply = process.argv.includes('--apply')
const aliases = [
  { source: 'youyeetoo x1', target: 'X1' },
]
const envPath = path.resolve('.env.local')
const projectRefArgIndex = process.argv.indexOf('--project-ref')
const expectedProjectRef = projectRefArgIndex >= 0 ? process.argv[projectRefArgIndex + 1] || '' : ''

if (!fs.existsSync(envPath)) {
  console.error('Missing .env.local. No product data was changed.')
  process.exit(1)
}

const localEnv = dotenv.parse(fs.readFileSync(envPath, 'utf8'))
const supabaseUrl = localEnv.VITE_SUPABASE_URL
const serviceRoleKey = localEnv.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. No product data was changed.')
  process.exit(1)
}

const target = getSupabaseTarget(supabaseUrl)
requireMatchingProjectRef({ apply, expectedProjectRef, actualProjectRef: target.projectRef })
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function fetchAll(table, columns, pageSize = 1000) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`${table} scan failed: ${error.message}`)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
    from += pageSize
  }
}

async function scanProductData() {
  const [products, invitations, shipments, collaborations] = await Promise.all([
    fetchAll('products', 'id, name, status'),
    fetchAll('invitations', 'id, product'),
    fetchAll('shipments', 'id, product'),
    fetchAll('collaborations', 'id, product'),
  ])

  return { products, invitations, shipments, collaborations }
}

function summarize(mapping) {
  return {
    source: mapping.sourceName,
    target: mapping.targetName,
    canonicalProductName: mapping.canonicalProductName,
    sourceProductCount: mapping.sourceProductIds.length,
    sourceProductStatuses: mapping.sourceProductStatuses,
    targetFound: Boolean(mapping.targetProductId),
    targetStatus: mapping.targetProductStatus,
    references: mapping.counts,
    errors: mapping.errors,
    safeToDeleteSource: mapping.safeToDeleteSource,
  }
}

async function rewriteReferences(mapping) {
  for (const table of ['invitations', 'shipments', 'collaborations']) {
    const ids = mapping.references[table]
    if (ids.length === 0) continue

    const { error } = await supabase
      .from(table)
      .update({ product: mapping.canonicalProductName })
      .in('id', ids)

    if (error) throw new Error(`${table} update failed: ${error.message}`)
  }
}

async function deleteSourceProducts(mapping) {
  if (!mapping.safeToDeleteSource || mapping.sourceProductIds.length === 0) return

  const { error } = await supabase
    .from('products')
    .delete()
    .in('id', mapping.sourceProductIds)

  if (error) throw new Error(`Duplicate product deletion failed: ${error.message}`)
}

async function main() {
  const result = await runProductAliasRepair({
    aliases,
    apply,
    scan: scanProductData,
    rewriteReferences,
    deleteSourceProducts,
  })
  console.log(JSON.stringify({
    mode: result.mode,
    target,
    mappings: result.plan.map(summarize),
    ...(apply ? {} : {
      nextStep: `Review the counts, then run npm run repair:product-aliases:apply -- --project-ref ${target.projectRef}.`,
    }),
  }, null, 2))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
