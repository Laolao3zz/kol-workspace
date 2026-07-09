#!/usr/bin/env node

/**
 * 数据库健康检查脚本
 * 用于检测和修复常见的数据问题
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { findOrphanRows, KOL_HEALTH_COLUMNS, PRODUCT_HEALTH_COLUMNS } from './health-utils.mjs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.log('⚪ 未找到 .env.local 中的 Supabase 配置，已跳过线上数据库健康检查。')
  console.log('   本地 UI 会自动使用 demo 数据；恢复 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 后可重新运行。')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fetchAll(table, columns, pageSize = 1000) {
  const rows = []
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, to)

    if (error) throw error
    rows.push(...(data || []))

    if (!data || data.length < pageSize) break
    from += pageSize
  }

  return rows
}

async function checkDatabaseHealth() {
  console.log('🔍 开始数据库健康检查...\n')

  const issues = []

  // 1. 检查 KOL 表
  console.log('📊 检查 KOL 表...')
  const { data: kols, error: kolError } = await supabase
    .from('kols')
    .select(KOL_HEALTH_COLUMNS)

  if (kolError) {
    issues.push(`KOL 表查询失败: ${kolError.message}`)
  } else {
    console.log(`✅ KOL 表正常 (${kols.length} 条记录)`)

    // 检查空名称
    const emptyNames = kols.filter(k => !k.name?.trim())
    if (emptyNames.length > 0) {
      issues.push(`发现 ${emptyNames.length} 个 KOL 名称为空`)
    }
  }

  // 2. Check Products table and product-targeting columns.
  console.log('Checking Products table...')
  const { data: products, error: productError } = await supabase
    .from('products')
    .select(PRODUCT_HEALTH_COLUMNS)

  if (productError) {
    issues.push(`Products table query failed: ${productError.message}`)
  } else {
    console.log(`Products table OK (${products.length} rows)`)

    const emptyProductNames = products.filter(product => !product.name?.trim())
    if (emptyProductNames.length > 0) {
      issues.push(`Found ${emptyProductNames.length} products with empty names`)
    }
  }

  // 3. 检查 Shipments 表
  console.log('📦 检查 Shipments 表...')
  const { data: shipments, error: shipmentError } = await supabase
    .from('shipments')
    .select('id, kol_id, product, status, tracking_number')

  if (shipmentError) {
    issues.push(`Shipments 表查询失败: ${shipmentError.message}`)
  } else {
    console.log(`✅ Shipments 表正常 (${shipments.length} 条记录)`)

    // 检查运输中但无快递单号
    const invalidShipments = shipments.filter(
      s => s.status === '运输中' && !s.tracking_number?.trim()
    )
    if (invalidShipments.length > 0) {
      issues.push(`发现 ${invalidShipments.length} 个运输中但无快递单号的记录`)
    }
  }

  // 3. 检查 Invitations 表
  console.log('📩 检查 Invitations 表...')
  const { data: invitations, error: invError } = await supabase
    .from('invitations')
    .select('id, kol_id, product')

  if (invError) {
    issues.push(`Invitations 表查询失败: ${invError.message}`)
  } else {
    console.log(`✅ Invitations 表正常 (${invitations.length} 条记录)`)
  }

  // 4. 检查 Collaborations 表
  console.log('🤝 检查 Collaborations 表...')
  const { data: collaborations, error: colError } = await supabase
    .from('collaborations')
    .select('id, kol_id, product')

  if (colError) {
    issues.push(`Collaborations 表查询失败: ${colError.message}`)
  } else {
    console.log(`✅ Collaborations 表正常 (${collaborations.length} 条记录)`)
  }

  // 5. 检查孤立记录
  console.log('🔗 检查数据关联...')
  try {
    const [allKols, allShipments, allInvitations, allCollaborations] = await Promise.all([
      fetchAll('kols', 'id'),
      fetchAll('shipments', 'id, kol_id'),
      fetchAll('invitations', 'id, kol_id'),
      fetchAll('collaborations', 'id, kol_id'),
    ])

    const orphanShipments = findOrphanRows(allShipments, allKols, 'kol_id')
    const orphanInvitations = findOrphanRows(allInvitations, allKols, 'kol_id')
    const orphanCollaborations = findOrphanRows(allCollaborations, allKols, 'kol_id')

    if (orphanShipments.length > 0) issues.push(`发现 ${orphanShipments.length} 个孤立的 shipment 记录（关联的 KOL 不存在）`)
    if (orphanInvitations.length > 0) issues.push(`发现 ${orphanInvitations.length} 个孤立的 invitation 记录（关联的 KOL 不存在）`)
    if (orphanCollaborations.length > 0) issues.push(`发现 ${orphanCollaborations.length} 个孤立的 collaboration 记录（关联的 KOL 不存在）`)
  } catch (err) {
    issues.push(`关联检查失败: ${err.message}`)
  }

  // 输出结果
  console.log('\n' + '='.repeat(50))
  if (issues.length === 0) {
    console.log('✅ 数据库健康状况良好！')
  } else {
    console.log('⚠️  发现以下问题：\n')
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`)
    })
    console.log('\n建议运行修复脚本或手动处理这些问题。')
  }
  console.log('='.repeat(50))
}

async function fixCommonIssues() {
  console.log('🔧 开始修复常见问题...\n')

  // 1. 修复运输中但无快递单号的记录
  console.log('📦 修复运输中但无快递单号的记录...')
  const { data: invalidShipments } = await supabase
    .from('shipments')
    .select('id')
    .eq('status', '运输中')
    .or('tracking_number.is.null,tracking_number.eq.')

  if (invalidShipments && invalidShipments.length > 0) {
    const { error } = await supabase
      .from('shipments')
      .update({ status: '待寄出' })
      .in('id', invalidShipments.map(s => s.id))

    if (error) {
      console.log(`❌ 修复失败: ${error.message}`)
    } else {
      console.log(`✅ 已修复 ${invalidShipments.length} 条记录`)
    }
  } else {
    console.log('✅ 无需修复')
  }

  console.log('\n修复完成！')
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'fix') {
    await fixCommonIssues()
  } else {
    await checkDatabaseHealth()
  }
}

main().catch(console.error)
