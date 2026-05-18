#!/usr/bin/env node

/**
 * 数据库健康检查脚本
 * 用于检测和修复常见的数据问题
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少 Supabase 配置，请检查 .env.local 文件')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabaseHealth() {
  console.log('🔍 开始数据库健康检查...\n')

  const issues = []

  // 1. 检查 KOL 表
  console.log('📊 检查 KOL 表...')
  const { data: kols, error: kolError } = await supabase
    .from('kols')
    .select('id, name, email, status')
    .limit(10)

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

  // 2. 检查 Shipments 表
  console.log('📦 检查 Shipments 表...')
  const { data: shipments, error: shipmentError } = await supabase
    .from('shipments')
    .select('id, kol_id, product, status, tracking_number')
    .limit(10)

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
    .limit(10)

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
    .limit(10)

  if (colError) {
    issues.push(`Collaborations 表查询失败: ${colError.message}`)
  } else {
    console.log(`✅ Collaborations 表正常 (${collaborations.length} 条记录)`)
  }

  // 5. 检查孤立记录
  console.log('🔗 检查数据关联...')
  if (shipments && kols) {
    const kolIds = new Set(kols.map(k => k.id))
    const orphanShipments = shipments.filter(s => !kolIds.has(s.kol_id))
    if (orphanShipments.length > 0) {
      issues.push(`发现 ${orphanShipments.length} 个孤立的 shipment 记录（关联的 KOL 不存在）`)
    }
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
