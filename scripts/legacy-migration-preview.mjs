import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const workbookPath = 'C:/Users/Administrator/Desktop/推广计划表.xlsx'
const outDir = 'C:/Users/Administrator/WorkBuddy/2026-05-12-task-2/migration-output'
const shipmentOverrides = new Map([
  ['Akashdeep Singh', { platform: 'Youtube', channel: 'The Wrench', product: 'YY3588' }],
  ['Dany', { platform: 'Discord', channel: 'https://superkali.me/', product: 'YY3588' }],
  ['Andrés López Salgado', { platform: 'Youtube', channel: 'RaspiZone', product: 'YY3588' }],
  ['Mahmoud Alturkmani', { platform: 'Youtube', channel: 'Details tech', product: 'NAS' }],
  ['Pedro Hernandez', { platform: '网站', channel: 'pcdemano.com', product: 'NAS' }],
  ['Rui Carmo', { platform: '网站', channel: 'https://taoofmac.com/', product: 'NAS' }],
  ['DIYMediaLLC', { platform: 'Youtube', channel: 'DoItYourselfDad', product: 'NAS' }],
  ['BONDAREV DMITRY SERGEEVICH', { platform: 'Youtube', channel: 'TechnoDrive', product: 'BY53' }],
  ['Michel Valdrighi', { platform: '网站', channel: 'https://www.minimachines.net/', product: 'NAS' }],
  ['Trevor Unland', { platform: '网站', channel: 'https://www.unland.dev/blog', product: 'X1s' }],
  ['Enrico Aguzzi', { platform: '网站', channel: 'www.enrico-dev.com', product: 'NAS/K1' }],
  ['Gabe Emerson', { platform: 'Youtube', channel: 'saveitforparts', product: 'Lora' }],
  ['Nate', { platform: 'Youtube', channel: 'Canadian Prepper', product: 'Lora' }],
  ['Steve McGrane', { platform: 'Youtube', channel: 'Temporarily Offline', product: 'Lora' }],
  ['GhostStrats LLC', { platform: 'Youtube', channel: 'GhostStrats', product: 'Lora' }],
])

function readZipEntries(buffer) {
  const sig = 0x06054b50
  let eocd = -1
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === sig) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Cannot find ZIP end of central directory')
  const total = buffer.readUInt16LE(eocd + 10)
  const cdOffset = buffer.readUInt32LE(eocd + 16)
  const entries = new Map()
  let ptr = cdOffset
  for (let i = 0; i < total; i++) {
    if (buffer.readUInt32LE(ptr) !== 0x02014b50) throw new Error('Invalid central directory')
    const method = buffer.readUInt16LE(ptr + 10)
    const compressedSize = buffer.readUInt32LE(ptr + 20)
    const fileNameLength = buffer.readUInt16LE(ptr + 28)
    const extraLength = buffer.readUInt16LE(ptr + 30)
    const commentLength = buffer.readUInt16LE(ptr + 32)
    const localOffset = buffer.readUInt32LE(ptr + 42)
    const name = buffer.slice(ptr + 46, ptr + 46 + fileNameLength).toString('utf8')
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const compressed = buffer.slice(dataStart, dataStart + compressedSize)
    let data
    if (method === 0) data = compressed
    else if (method === 8) data = zlib.inflateRawSync(compressed)
    else throw new Error(`Unsupported ZIP compression method ${method} for ${name}`)
    entries.set(name, data.toString('utf8'))
    ptr += 46 + fileNameLength + extraLength + commentLength
  }
  return entries
}

function decodeXml(s = '') {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function stripTags(s = '') {
  return decodeXml(s.replace(/<[^>]+>/g, ''))
}

function parseAttrs(tag) {
  const attrs = {}
  const re = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g
  let m
  while ((m = re.exec(tag))) attrs[m[1]] = decodeXml(m[2])
  return attrs
}

function parseSharedStrings(xml = '') {
  const values = []
  const siRe = /<si[\s\S]*?<\/si>/g
  let m
  while ((m = siRe.exec(xml))) {
    const si = m[0]
    const texts = []
    const tRe = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g
    let t
    while ((t = tRe.exec(si))) texts.push(decodeXml(t[1]))
    values.push(texts.length ? texts.join('') : stripTags(si))
  }
  return values
}

function parseWorkbook(entries) {
  const workbook = entries.get('xl/workbook.xml') || ''
  const rels = entries.get('xl/_rels/workbook.xml.rels') || ''
  const relMap = new Map()
  const relRe = /<Relationship\b[^>]*>/g
  let rel
  while ((rel = relRe.exec(rels))) {
    const attrs = parseAttrs(rel[0])
    relMap.set(attrs.Id, attrs.Target)
  }
  const sheets = []
  const sheetRe = /<sheet\b[^>]*>/g
  let sh
  while ((sh = sheetRe.exec(workbook))) {
    const attrs = parseAttrs(sh[0])
    const rid = attrs['r:id']
    const target = relMap.get(rid)
    if (target) sheets.push({ name: attrs.name, path: `xl/${target.replace(/^\//, '')}`.replace('xl/xl/', 'xl/') })
  }
  return sheets
}

function colToIndex(ref) {
  const letters = ref.replace(/[^A-Z]/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function parseSheet(xml, sharedStrings) {
  const merges = parseMergeRanges(xml)
  const rows = []
  const rowRe = /<row\b[^>]*>[\s\S]*?<\/row>/g
  let rowMatch
  while ((rowMatch = rowRe.exec(xml))) {
    const rowXml = rowMatch[0]
    const rowAttrs = parseAttrs(rowXml.match(/<row\b[^>]*>/)?.[0] || '')
    const rowNum = Number(rowAttrs.r || rows.length + 1)
    const row = []
    const present = []
    const cellRe = /<c\b[^>]*>[\s\S]*?<\/c>/g
    let cellMatch
    while ((cellMatch = cellRe.exec(rowXml))) {
      const cellXml = cellMatch[0]
      const attrs = parseAttrs(cellXml.match(/<c\b[^>]*>/)?.[0] || '')
      const idx = attrs.r ? colToIndex(attrs.r) : row.length
      let value = ''
      const inline = cellXml.match(/<is>([\s\S]*?)<\/is>/)
      const v = cellXml.match(/<v>([\s\S]*?)<\/v>/)
      if (attrs.t === 'inlineStr' && inline) value = stripTags(inline[1])
      else if (attrs.t === 's' && v) value = sharedStrings[Number(v[1])] ?? ''
      else if (v) value = decodeXml(v[1])
      row[idx] = String(value).trim()
      present[idx] = true
    }
    if (row.some(Boolean)) rows.push({ rowNum, values: row, present })
  }
  applyMergedCells(rows, merges)
  return rows
}

function parseCellRef(ref) {
  const match = String(ref || '').match(/^([A-Z]+)(\d+)$/)
  if (!match) return null
  return { col: colToIndex(match[1]), row: Number(match[2]) }
}

function parseMergeRanges(xml) {
  const ranges = []
  const mergeRe = /<mergeCell\s+ref="([^"]+)"/g
  let match
  while ((match = mergeRe.exec(xml))) {
    const [startRef, endRef] = match[1].split(':')
    const start = parseCellRef(startRef)
    const end = parseCellRef(endRef)
    if (start && end) ranges.push({ start, end })
  }
  return ranges
}

function applyMergedCells(rows, merges) {
  const rowMap = new Map(rows.map(row => [row.rowNum, row]))
  for (const merge of merges) {
    const sourceRow = rowMap.get(merge.start.row)
    const value = sourceRow?.values?.[merge.start.col]
    if (!value) continue
    for (let rowNum = merge.start.row; rowNum <= merge.end.row; rowNum++) {
      const row = rowMap.get(rowNum)
      if (!row) continue
      for (let col = merge.start.col; col <= merge.end.col; col++) {
        if (!row.values[col]) row.values[col] = value
      }
    }
  }
}

function excelSerialToDate(value) {
  if (!value) return ''
  const text = String(value).trim()
  if (/待审查|待审核|待定|未知|不详|na|n\/a/i.test(text)) return ''
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(text)) {
    const parts = text.split(/[-/]/).map(Number)
    return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return text
  const serial = Number(text)
  if (serial < 20000 || serial > 60000) return text
  const utcDays = Math.floor(serial - 25569)
  const date = new Date(utcDays * 86400 * 1000)
  return date.toISOString().slice(0, 10)
}

function normalizeHeader(s) {
  return String(s || '').replace(/\s+/g, '').trim()
}

function rowObj(headers, values) {
  const obj = {}
  headers.forEach((h, i) => {
    if (h) obj[h] = values[i] || ''
  })
  return obj
}

function isEmail(s) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(s || ''))
}

function parseNumberLike(s) {
  const raw = String(s || '').trim()
  if (!raw) return ''
  const cleaned = raw.replace(/,/g, '')
  const m = cleaned.match(/\d+(?:\.\d+)?/)
  return m ? m[0] : raw
}

function inferPlatform(urlOrPlatform) {
  const s = String(urlOrPlatform || '').toLowerCase()
  if (s.includes('youtube') || s.includes('youtu.be')) return 'YouTube'
  if (s.includes('tiktok')) return 'TikTok'
  if (s.includes('instagram')) return 'Instagram'
  if (s.includes('twitter') || s.includes('x.com')) return 'X'
  if (s.includes('blog')) return 'Blog'
  return ''
}

function mapShipmentStatus(s) {
  const v = String(s || '').trim()
  if (!v) return '待寄出'
  if (/已送达|已签收|签收|送达|delivered/i.test(v)) return '已签收'
  if (/运输|已寄|寄出|在途|shipped|transit/i.test(v)) return '运输中'
  if (/待寄|未寄|准备/i.test(v)) return '待寄出'
  return '运输中'
}

function csvEscape(v) {
  const s = String(v ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function writeCsv(file, rows, headers) {
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map(h => csvEscape(row[h])).join(','))
  fs.writeFileSync(path.join(outDir, file), lines.join('\n'), 'utf8')
}

function firstNonEmpty(...vals) {
  return vals.find(v => String(v || '').trim()) || ''
}

function isSequentialNo(value) {
  const text = String(value || '').trim()
  return /^\d+$/.test(text)
}

function isLikelyProduct(value) {
  const text = String(value || '').trim()
  if (!text) return false
  return /^(BY\d+|R\d+|X\d+s?|K\d+|N\d+|Z\d+|YY\d+|NAS|Lora|LoRa)$/i.test(text)
}

function splitUrls(text) {
  return String(text || '').match(/https?:\/\/[^\s]+/g) || []
}

function detectProductFromRow(obj) {
  const explicitProduct = obj['推广产品'] || ''
  if (isLikelyProduct(explicitProduct)) return explicitProduct
  const no = obj['No.'] || obj['No'] || ''
  if (!isSequentialNo(no) && isLikelyProduct(no)) return no
  return explicitProduct
}

function chooseKolKey(name, url) {
  const cleanUrl = String(url || '').trim()
  const cleanName = String(name || '').trim()
  return (cleanUrl || cleanName).toLowerCase()
}

function normalizeIdentity(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim()) || /\.[a-z]{2,}(\/|$)/i.test(String(value || '').trim())
}

function ensureUrl(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/^https?:\/\//i.test(text)) return text
  return isLikelyUrl(text) ? `https://${text}` : ''
}

function productCategory(product) {
  const text = String(product || '').trim()
  if (!text) return ''
  if (/lora/i.test(text)) return '户外装备'
  if (/nas/i.test(text)) return 'NAS'
  if (/^(yy|by|x|k|r|n|z)\d/i.test(text)) return 'SBC'
  return ''
}

function main() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`)
  fs.mkdirSync(outDir, { recursive: true })

  const entries = readZipEntries(fs.readFileSync(workbookPath))
  const sharedStrings = parseSharedStrings(entries.get('xl/sharedStrings.xml') || '')
  const sheets = parseWorkbook(entries)
  const parsed = {}
  for (const sheet of sheets) parsed[sheet.name] = parseSheet(entries.get(sheet.path) || '', sharedStrings)

  const kolRows = parsed['KOL记录'] || []
  const shipRows = parsed['已寄样KOL跟踪'] || []
  const kolHeaders = (kolRows[0]?.values || []).map(normalizeHeader)
  const shipHeaders = (shipRows[0]?.values || []).map(normalizeHeader)

  const kolsByKey = new Map()
  const kolAliases = new Map()
  const collaborations = []
  const shipments = []
  const shipmentKolCandidates = []
  const warnings = []
  let currentKolKey = ''

  function upsertKol(data, source) {
    const name = String(data.name || '').trim()
    const url = String(data.homepage_url || '').trim()
    if (!name && !url) return ''
    const key = chooseKolKey(name, url)
    const existing = kolsByKey.get(key) || {
      legacy_key: key,
      name: '',
      email: '',
      homepage_url: '',
      platform: '',
      followers: '',
      country: '',
      tags: '',
      status: '未首触',
      sample_product: '',
      sample_date: '',
      tracking_number: '',
      shipping_details: '',
      source: '',
      review_note: '',
    }
    for (const [k, v] of Object.entries(data)) {
      if (k === 'tags') {
        const merged = new Set(String(existing.tags || '').split('|').filter(Boolean))
        String(v || '').split('|').filter(Boolean).forEach(x => merged.add(x))
        existing.tags = [...merged].join('|')
      } else if (k === 'status') {
        const rank = { '未首触': 1, '已邀约': 2, '待寄出': 3, '运输中': 4, '已签收': 5, '合作完成': 6, '拒绝合作': 7 }
        if ((rank[v] || 0) > (rank[existing.status] || 0)) existing.status = v
      } else if (v && !existing[k]) existing[k] = v
    }
    existing.source = Array.from(new Set(`${existing.source}|${source}`.split('|').filter(Boolean))).join('|')
    kolsByKey.set(key, existing)
    ;[existing.name, existing.homepage_url, key].forEach(alias => {
      const normalized = normalizeIdentity(alias)
      if (normalized) kolAliases.set(normalized, key)
    })
    return key
  }

  for (const r of kolRows.slice(1)) {
    const obj = rowObj(kolHeaders, r.values)
    const no = obj['No.'] || obj['No'] || ''
    const isMainKolRow = isSequentialNo(no)
    const name = isMainKolRow ? firstNonEmpty(obj['名字'], obj['频道名']) : ''
    const url = obj['主页链接'] || ''
    const contact = obj['联系方式'] || ''
    const address = obj['地址'] || ''
    const tags = [obj['KOL类型'], obj['产品类型']].filter(Boolean).join('|')
    const collaborated = obj['是否合作过'] || ''
    const product = detectProductFromRow(obj)
    const rawPostUrl = obj['链接'] || ''
    const urlsFromProductCell = splitUrls(obj['推广产品'] || '')
    const urlsFromLinkCell = splitUrls(rawPostUrl)
    const postUrls = urlsFromLinkCell.length ? urlsFromLinkCell : urlsFromProductCell
    const postUrl = postUrls.join('\n') || rawPostUrl
    const views = obj['播放量'] || ''
    const comments = obj['评论数'] || ''
    const note = obj['备注'] || ''

    if (isMainKolRow) {
      currentKolKey = upsertKol({
        name,
        homepage_url: url,
        platform: inferPlatform(url),
        followers: obj['粉丝数'] || '',
        email: isEmail(contact) ? contact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)[0] : '',
        shipping_details: address,
        tags,
        status: /是|合作|已合作/i.test(collaborated) ? '合作完成' : '未首触',
        review_note: !isEmail(contact) && contact ? `联系方式非邮箱：${contact}` : '',
      }, 'KOL记录')
    }

    if ((product || postUrl || views || comments) && currentKolKey) {
      collaborations.push({
        legacy_kol_key: currentKolKey,
        kol_name: kolsByKey.get(currentKolKey)?.name || '',
        product,
        cooperation_date: '',
        publish_date: '',
        post_url: postUrl,
        views: parseNumberLike(views),
        comments: parseNumberLike(comments),
        likes: '',
        fee: '',
        notes: note,
        source: 'KOL记录',
        review_note: postUrl && !/^https?:\/\//i.test(postUrl) ? '作品链接可能不是 URL' : '',
      })
      const kol = kolsByKey.get(currentKolKey)
      if (kol && product && !kol.sample_product) kol.sample_product = product
      if (kol && (postUrl || views || comments)) kol.status = '合作完成'
    }
  }

  for (const r of shipRows.slice(1)) {
    const obj = rowObj(shipHeaders, r.values)
    const rawName = firstNonEmpty(obj['KOL名称'], obj['频道名'])
    if (!rawName) continue
    const override = shipmentOverrides.get(rawName)
    const channelName = override?.channel || obj['频道名'] || ''
    const displayName = channelName || rawName
    const homepageUrl = ensureUrl(channelName)
    const aliasKey = kolAliases.get(normalizeIdentity(channelName)) || kolAliases.get(normalizeIdentity(homepageUrl)) || ''
    const platform = override?.platform || obj['平台'] || inferPlatform(homepageUrl || displayName)
    const product = override?.product || obj['产品名称'] || ''
    const sampleDateRaw = obj['寄样日期'] || ''
    const sampleDate = excelSerialToDate(sampleDateRaw)
    const tracking = obj['快递单号'] || ''
    const rawLogistics = obj['物流状态'] || ''
    const status = mapShipmentStatus(rawLogistics)
    const contentProgress = obj['内容进度'] || ''
    const effect = obj['效果（一个月）'] || obj['效果(一个月)'] || ''
    const publishDate = excelSerialToDate(obj['预计发布时间'] || '')
    const fee = obj['佣金'] || ''

    const key = aliasKey || chooseKolKey(displayName, homepageUrl)
    const productTag = productCategory(product)
    shipmentKolCandidates.push({
      key,
      name: displayName,
      contact_name: rawName,
      platform,
      status,
      sample_product: product,
      sample_date: sampleDate,
      tracking_number: tracking,
      channel_name: channelName,
      homepage_url: homepageUrl,
      tags: productTag,
    })

    if (key && product) {
      shipments.push({
        legacy_kol_key: key,
        kol_name: kolsByKey.get(key)?.name || displayName,
        product,
        sample_date: sampleDate,
        tracking_number: tracking,
        shipping_details: '',
        status,
        raw_logistics_status: rawLogistics,
        notes: [rawName !== displayName ? `联系人/KOL名称：${rawName}` : '', channelName ? `频道名/网站名：${channelName}` : '', contentProgress && !/^https?:\/\//i.test(contentProgress) ? contentProgress : ''].filter(Boolean).join('\n'),
        delivered_at: status === '已签收' ? sampleDate : '',
        source: '已寄样KOL跟踪',
        review_note: !sampleDate ? (sampleDateRaw ? `寄样日期待确认：${sampleDateRaw}` : '缺少寄样日期') : '',
      })
    }

    if (key && (contentProgress || effect || publishDate || fee)) {
      const looksLikeUrl = /^https?:\/\//i.test(contentProgress)
      collaborations.push({
        legacy_kol_key: key,
        kol_name: kolsByKey.get(key)?.name || displayName,
        product,
        cooperation_date: sampleDate,
        publish_date: publishDate,
        post_url: looksLikeUrl ? contentProgress : '',
        views: parseNumberLike(effect),
        comments: '',
        likes: '',
        fee: parseNumberLike(fee),
        notes: [rawName !== displayName ? `联系人/KOL名称：${rawName}` : '', channelName ? `频道名/网站名：${channelName}` : '', looksLikeUrl ? '' : contentProgress].filter(Boolean).join('\n'),
        source: '已寄样KOL跟踪',
        review_note: contentProgress && !looksLikeUrl ? '内容进度为文字，未识别为作品链接' : '',
      })
      const kol = kolsByKey.get(key)
      if (kol) {
        if (product && !kol.sample_product) kol.sample_product = product
        if (sampleDate && !kol.sample_date) kol.sample_date = sampleDate
        if (tracking && !kol.tracking_number) kol.tracking_number = tracking
        if (status && (kol.status === '未首触' || kol.status === '已邀约')) kol.status = status
        if (productTag) {
          const merged = new Set(String(kol.tags || '').split('|').filter(Boolean))
          merged.add(productTag)
          kol.tags = [...merged].join('|')
        }
      }
    }
  }

  for (const candidate of shipmentKolCandidates) {
    if (!kolsByKey.has(candidate.key)) {
      upsertKol({
        name: candidate.name,
        platform: candidate.platform,
        status: candidate.status,
        sample_product: candidate.sample_product,
        sample_date: candidate.sample_date,
        tracking_number: candidate.tracking_number,
        homepage_url: candidate.homepage_url,
        tags: candidate.tags,
        review_note: [candidate.contact_name && candidate.contact_name !== candidate.name ? `联系人/KOL名称：${candidate.contact_name}` : '', candidate.channel_name && !candidate.homepage_url ? `频道名/网站名：${candidate.channel_name}` : ''].filter(Boolean).join('；'),
      }, '已寄样KOL跟踪')
    }
  }

  const kols = [...kolsByKey.values()].map(k => ({
    ...k,
    review_note: [k.review_note, !k.platform ? '平台待补充' : '', !k.email ? '邮箱待补充或无邮箱' : ''].filter(Boolean).join('；')
  }))

  writeCsv('clean_kols.csv', kols, ['legacy_key', 'name', 'email', 'homepage_url', 'platform', 'followers', 'country', 'tags', 'status', 'sample_product', 'sample_date', 'tracking_number', 'shipping_details', 'source', 'review_note'])
  writeCsv('clean_shipments.csv', shipments, ['legacy_kol_key', 'kol_name', 'product', 'sample_date', 'tracking_number', 'shipping_details', 'status', 'raw_logistics_status', 'notes', 'delivered_at', 'source', 'review_note'])
  writeCsv('clean_collaborations.csv', collaborations, ['legacy_kol_key', 'kol_name', 'product', 'cooperation_date', 'publish_date', 'post_url', 'views', 'comments', 'likes', 'fee', 'notes', 'source', 'review_note'])

  const statusCount = kols.reduce((acc, k) => (acc[k.status] = (acc[k.status] || 0) + 1, acc), {})
  const shipmentStatusCount = shipments.reduce((acc, s) => (acc[s.status] = (acc[s.status] || 0) + 1, acc), {})
  const kolMainRowCount = kolRows.slice(1).filter(r => {
    const obj = rowObj(kolHeaders, r.values)
    return isSequentialNo(obj['No.'] || obj['No'] || '')
  }).length
  const shipmentEffectiveRowCount = shipments.length
  const reviewKols = kols.filter(k => k.review_note).slice(0, 30)
  const reviewShipments = shipments.filter(s => s.review_note).slice(0, 30)
  const reviewCollaborations = collaborations.filter(c => c.review_note).slice(0, 30)

  const md = `# 旧 KOL 数据迁移预览报告\n\n源文件：\`${workbookPath}\`\n\n生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n## 1. 解析结果概览\n\n| 项目 | 数量 |\n|---|---:|\n| Sheet：KOL记录 原始非空行 | ${Math.max(0, kolRows.length - 1)} |\n| Sheet：KOL记录 主 KOL 行 | ${kolMainRowCount} |\n| Sheet：已寄样KOL跟踪 原始非空行 | ${Math.max(0, shipRows.length - 1)} |\n| Sheet：已寄样KOL跟踪 有效寄样行 | ${shipmentEffectiveRowCount} |\n| 清洗后 KOL | ${kols.length} |\n| 清洗后寄样记录 | ${shipments.length} |\n| 清洗后合作记录 | ${collaborations.length} |\n\n## 2. KOL 主状态分布\n\n${Object.entries(statusCount).map(([k, v]) => `- ${k}：${v}`).join('\n') || '- 无'}\n\n## 3. 寄样状态分布\n\n${Object.entries(shipmentStatusCount).map(([k, v]) => `- ${k}：${v}`).join('\n') || '- 无'}\n\n## 4. 已生成文件\n\n- \`clean_kols.csv\`：准备导入 Supabase \`kols\` 表的基础信息。\n- \`clean_shipments.csv\`：准备导入 \`shipments\` 表的寄样记录。\n- \`clean_collaborations.csv\`：准备导入 \`collaborations\` 表的合作记录。\n\n## 5. 需要你重点检查的问题\n\n### KOL 信息待检查（最多展示 30 条）\n\n| KOL | 平台 | 状态 | 问题 |\n|---|---|---|---|\n${reviewKols.map(k => `| ${k.name || k.legacy_key} | ${k.platform} | ${k.status} | ${k.review_note.replace(/\|/g, '/')} |`).join('\n') || '| 无 |  |  |  |'}\n\n### 寄样记录待检查（最多展示 30 条）\n\n| KOL | 产品 | 寄样日期 | 状态 | 问题 |\n|---|---|---|---|---|\n${reviewShipments.map(s => `| ${s.kol_name} | ${s.product} | ${s.sample_date} | ${s.status} | ${s.review_note.replace(/\|/g, '/')} |`).join('\n') || '| 无 |  |  |  |  |'}\n\n### 合作记录待检查（最多展示 30 条）\n\n| KOL | 产品 | 链接 | 效果 | 问题 |\n|---|---|---|---|---|\n${reviewCollaborations.map(c => `| ${c.kol_name} | ${c.product} | ${c.post_url} | ${c.views} | ${c.review_note.replace(/\|/g, '/')} |`).join('\n') || '| 无 |  |  |  |  |'}\n\n## 6. 当前清洗规则\n\n- 旧邀约信息暂不导入，避免多行邀约造成误判。\n- \`KOL记录\` 中有推广产品、链接、播放/评论数据的行，会生成合作记录。\n- \`已寄样KOL跟踪\` 的前15条使用用户补充的“频道名/网站名”和“产品名称”映射，不再把原表频道名列误当产品名。\n- \`已寄样KOL跟踪\` 中有产品名称的行，会生成寄样记录。\n- 物流状态 \`已送达/已签收/送达\` 映射为 \`已签收\`。\n- 物流状态 \`已寄出/运输中/在途\` 映射为 \`运输中\`。\n- 空物流状态映射为 \`待寄出\`。\n- Excel 日期序列号已转换为 \`YYYY-MM-DD\`。\n- 非邮箱联系方式不会强塞进 email，会标记到 review_note。\n\n## 7. 建议下一步\n\n请先检查这三个 CSV，尤其是：\n\n1. KOL 是否重复或名称错配；\n2. 平台是否缺失；\n3. 寄样日期是否正确；\n4. 物流状态是否合理；\n5. 合作链接是否挂到了正确 KOL。\n\n确认后，我再生成最终的 Supabase 导入 SQL。\n`

  fs.writeFileSync(path.join(outDir, 'legacy-migration-preview.md'), md, 'utf8')
  fs.writeFileSync(path.join(outDir, 'migration-summary.json'), JSON.stringify({
    source: workbookPath,
    sheets: sheets.map(s => s.name),
    counts: { rawKolRows: Math.max(0, kolRows.length - 1), kolMainRows: kolMainRowCount, rawShipmentRows: Math.max(0, shipRows.length - 1), effectiveShipmentRows: shipmentEffectiveRowCount, kols: kols.length, shipments: shipments.length, collaborations: collaborations.length },
    statusCount,
    shipmentStatusCount,
    warnings,
  }, null, 2), 'utf8')

  console.log(JSON.stringify({ outDir, counts: { rawKolRows: Math.max(0, kolRows.length - 1), kolMainRows: kolMainRowCount, rawShipmentRows: Math.max(0, shipRows.length - 1), effectiveShipmentRows: shipmentEffectiveRowCount, kols: kols.length, shipments: shipments.length, collaborations: collaborations.length }, statusCount, shipmentStatusCount }, null, 2))
}

main()
