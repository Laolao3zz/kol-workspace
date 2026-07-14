import { Check, ChevronDown, ChevronUp, Copy, Inbox, RefreshCw, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Email } from '../types'
import { getEmailsByKOL } from '../services/emailService'
import { buildCommunicationPrompt } from '../utils/communicationPrompt'

interface Props {
  kolName: string
  kolEmail: string
  kolId: string
}

export default function MailPanel({ kolName, kolEmail, kolId }: Props) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    void loadEmails()
  }, [kolId])

  const loadEmails = async () => {
    setLoading(true)
    setError('')
    setCopyState('idle')
    try {
      setEmails(await getEmailsByKOL(kolId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '邮件记录加载失败')
    } finally {
      setLoading(false)
    }
  }

  const copyForAi = async () => {
    if (emails.length === 0) return
    try {
      await navigator.clipboard.writeText(buildCommunicationPrompt({ kolName, kolEmail, emails }))
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const formatDate = (iso: string) => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso || '-'
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const inboundCount = emails.filter(email => email.direction === 'inbound').length
  const outboundCount = emails.length - inboundCount

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-3">
        <div>
          <div className="text-sm font-extrabold text-[#1D1D1F]">邮件往来</div>
          <div className="mt-0.5 text-[11px] font-semibold text-[#86868B]">
            {emails.length} 封 · 收到 {inboundCount} · 发出 {outboundCount}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadEmails()}
            disabled={loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#F5F5F7] text-[#6E6E73] transition hover:bg-gray-200 disabled:opacity-50"
            title="刷新邮件"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={copyForAi}
            disabled={emails.length === 0}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] bg-[#1D1D1F] px-3 text-[11px] font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-35"
          >
            {copyState === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copyState === 'copied' ? '已复制' : '复制 AI 分析材料'}
          </button>
        </div>
      </div>

      {copyState === 'failed' && (
        <div className="mb-2 rounded-[9px] bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">
          复制失败，请检查浏览器剪贴板权限后重试。
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-[10px] bg-[#F5F5F7]" />
          ))
        ) : emails.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-[12px] border border-dashed border-black/[0.08] bg-[#F5F5F7] px-5 text-center">
            <Inbox className="mb-2 h-5 w-5 text-[#AEAEB2]" />
            <div className="text-xs font-bold text-[#6E6E73]">{error ? '邮件记录加载失败' : '暂无已同步邮件'}</div>
            {error && <div className="mt-1 max-w-sm text-[11px] font-medium text-red-500">{error}</div>}
          </div>
        ) : (
          emails.map(email => {
            const outbound = email.direction === 'outbound'
            const expanded = expandedId === email.id
            return (
              <button
                key={email.id}
                type="button"
                onClick={() => setExpandedId(expanded ? null : email.id)}
                className="block w-full rounded-[10px] border border-black/[0.06] bg-white p-3 text-left transition hover:border-black/[0.12] hover:bg-[#FBFBFD]"
              >
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${outbound ? 'bg-blue-50 text-[#0066FF]' : 'bg-emerald-50 text-emerald-700'}`}>
                    {outbound ? <Send className="h-3.5 w-3.5" /> : <Inbox className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-[11px] font-extrabold ${outbound ? 'text-[#0066FF]' : 'text-emerald-700'}`}>
                        {outbound ? '我方发出' : 'KOL 发来'}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold text-[#86868B]">{formatDate(email.sent_at)}</span>
                    </div>
                    <div className="mt-1 truncate text-xs font-extrabold text-[#1D1D1F]" title={email.subject}>{email.subject || '(无主题)'}</div>
                    <div className={`mt-1 whitespace-pre-wrap break-words text-[11px] font-medium leading-5 text-[#6E6E73] ${expanded ? '' : 'line-clamp-2'}`}>
                      {email.body || '(无正文)'}
                    </div>
                  </div>
                  {expanded ? <ChevronUp className="mt-1 h-3.5 w-3.5 shrink-0 text-[#AEAEB2]" /> : <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 text-[#AEAEB2]" />}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
