import { useState, useEffect } from 'react'
import { Email } from '../types'
import { getEmailsByKOL } from '../services/emailService'

interface Props {
  kolEmail: string
  kolId: string
}

export default function MailPanel({ kolEmail: _kolEmail, kolId }: Props) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadEmails()
  }, [kolId])

  const loadEmails = async () => {
    setLoading(true)
    try {
      const data = await getEmailsByKOL(kolId)
      setEmails(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + 
           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          ✉️ 邮件往来
        </h3>
        <button onClick={loadEmails} className="text-xs text-gray-400 hover:text-blue-500 transition-colors">
          刷新
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-50 rounded-lg animate-pulse" />
          ))
        ) : emails.length === 0 ? (
          <div className="text-xs text-gray-400 text-center py-8 space-y-2">
            <p>暂无邮件记录</p>
            <p className="max-w-sm mx-auto leading-relaxed">邮件不会自动出现在这里，需要先运行邮件同步，并确认 .env.local 中的 IMAP 配置、发件箱文件夹和 KOL 邮箱匹配正确。</p>
          </div>
        ) : (
          emails.map(email => (
            <div
              key={email.id}
              onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
              className={`rounded-lg p-3 cursor-pointer transition-all hover:shadow-sm ${
                email.direction === 'outbound' 
                  ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-100' 
                  : 'bg-gray-50 border border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${email.direction === 'outbound' ? 'text-blue-600' : 'text-gray-700'}`}>
                  {email.direction === 'outbound' ? '我方发出' : email.from_address.split('@')[0]}
                </span>
                <span className="text-[11px] text-gray-400">{formatDate(email.sent_at)}</span>
              </div>
              <div className="text-xs font-medium text-gray-800 mb-1">{email.subject}</div>
              <div className="text-xs text-gray-500 leading-relaxed">
                {expandedId === email.id ? email.body : email.body.slice(0, 80) + (email.body.length > 80 ? '...' : '')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
