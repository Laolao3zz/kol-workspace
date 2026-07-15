import { useState, useRef, useEffect } from 'react'

interface Props {
  label: string
  value: string
  onSave: (value: string) => void | Promise<void>
  type?: 'text' | 'select' | 'date' | 'textarea'
  options?: string[]
}

export default function InlineEdit({ label, value, onSave, type = 'text', options = [] }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== value) {
      onSave(draft)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      commit()
    }
    if (e.key === 'Escape') {
      setDraft(value)
      setEditing(false)
    }
  }

  return (
    <div className="mb-1 min-w-0 max-w-full">
      <span className="text-[11px] text-gray-400 block">{label}</span>
      {!editing ? (
        <div
          onClick={() => setEditing(true)}
          className="min-h-[28px] max-w-full cursor-text break-words rounded-sm border-b border-dashed border-gray-200 px-1 py-1 text-sm text-gray-800 transition-colors [overflow-wrap:anywhere] hover:bg-blue-50/50"
          title={value || undefined}
        >
          {value || <span className="text-gray-300 italic">点击编辑</span>}
        </div>
      ) : type === 'select' ? (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={e => { setDraft(e.target.value); }}
          onBlur={commit}
          className="min-w-0 w-full text-sm py-1 px-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        >
          <option value="">--</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : type === 'date' ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 w-full text-sm py-1 px-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      ) : type === 'textarea' ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          rows={3}
          className="min-w-0 w-full text-sm py-1 px-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 w-full text-sm py-1 px-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      )}
    </div>
  )
}
