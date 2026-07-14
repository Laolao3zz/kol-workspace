import type { Email } from '../types'

function normalizeBody(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value)
  if (Number.isNaN(timestamp.getTime())) return value || '时间未知'
  return timestamp.toLocaleString('zh-CN', { hour12: false })
}

export function buildCommunicationPrompt({
  kolName,
  kolEmail,
  emails,
}: {
  kolName: string
  kolEmail: string
  emails: Email[]
}): string {
  const timeline = [...emails]
    .sort((left, right) => left.sent_at.localeCompare(right.sent_at))
    .map((email, index) => [
      `--- 邮件 ${index + 1} / ${emails.length} ---`,
      `方向：${email.direction === 'outbound' ? '我方发出' : 'KOL 发来'}`,
      `时间：${formatTimestamp(email.sent_at)}`,
      `主题：${email.subject || '(无主题)'}`,
      `发件人：${email.from_address || '-'}`,
      `收件人：${email.to_address || '-'}`,
      '正文：',
      normalizeBody(email.body || '') || '(无正文)',
    ].join('\n'))
    .join('\n\n')

  return [
    '请根据以下完整邮件往来，帮助我继续跟进这个 KOL。不要编造邮件中没有的信息。',
    '',
    `KOL：${kolName || '未命名'}`,
    `邮箱：${kolEmail || '未填写'}`,
    `邮件数量：${emails.length}`,
    '',
    '请按以下格式输出：',
    '1. 沟通摘要：按时间概括双方谈过什么。',
    '2. 已确认事项：产品、合作形式、报价、寄样、时间等。',
    '3. 尚未解决：仍在等待谁确认什么。',
    '4. 下一步建议：我现在最应该做什么。',
    '5. 回复草稿：沿用对方邮件语言，简洁自然，可直接发送；若目前不需要回复，请明确说明。',
    '',
    '邮件往来（按最早到最新）：',
    timeline || '(暂无已同步邮件)',
  ].join('\n')
}
