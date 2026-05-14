import { useMemo, useState } from 'react'
import { PLATFORMS, TAGS } from '../types'
import type { KOL } from '../types'

interface Props {
  onClose: () => void
  onSubmit: (data: KolFormData) => void
  existingKols: KOL[]
  countryOptions: string[]
}

export interface KolFormData {
  name: string
  email: string
  platform: string
  homepage_url: string
  followers: string
  country: string
  tags: string[]
}

type DuplicateMatch = {
  kol: KOL
  fields: string[]
}

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
const normalizeEmail = (value: string) => value.trim().toLowerCase()

const normalizeChannelUrl = (value: string) => {
  const raw = value.trim().toLowerCase()
  if (!raw) return ''

  const parseable = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(parseable)
    const host = url.hostname.replace(/^www\./, '')
    const path = url.pathname.replace(/\/+$/, '')
    return `${host}${path}`
  } catch {
    return raw
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split(/[?#]/)[0]
      .replace(/\/+$/, '')
  }
}

export default function AddKolModal({ onClose, onSubmit, existingKols, countryOptions }: Props) {
  const [form, setForm] = useState<KolFormData>({
    name: '',
    email: '',
    platform: 'YouTube',
    homepage_url: '',
    followers: '',
    country: '',
    tags: [],
  })
  const [tagInput, setTagInput] = useState('')
  const [customCountry, setCustomCountry] = useState(false)

  const duplicateMatches = useMemo<DuplicateMatch[]>(() => {
    const name = normalizeText(form.name)
    const email = normalizeEmail(form.email)
    const homepage = normalizeChannelUrl(form.homepage_url)

    if (!name && !email && !homepage) return []

    return existingKols.reduce<DuplicateMatch[]>((matches, kol) => {
      const fields: string[] = []
      if (name && normalizeText(kol.name || '') === name) fields.push('名称')
      if (email && normalizeEmail(kol.email || '') === email) fields.push('邮箱')
      if (homepage && normalizeChannelUrl(kol.homepage_url || '') === homepage) fields.push('主页/频道链接')

      if (fields.length > 0) matches.push({ kol, fields })
      return matches
    }, [])
  }, [existingKols, form.name, form.email, form.homepage_url])

  const hasDuplicate = duplicateMatches.length > 0

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || hasDuplicate) return
    onSubmit(form)
  }

  const addTag = (tag: string) => {
    const t = tag.trim()
    if (t && !form.tags.includes(t)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, t] }))
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">新增 KOL</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              博主名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 ${hasDuplicate ? 'border-red-300 bg-red-50/40 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-400'}`}
              placeholder="必填"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">联系邮箱</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 ${hasDuplicate ? 'border-red-300 bg-red-50/40 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-400'}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">核心平台</label>
              <select
                value={form.platform}
                onChange={e => setForm(prev => ({ ...prev, platform: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">主页链接</label>
            <input
              type="text"
              value={form.homepage_url}
              onChange={e => setForm(prev => ({ ...prev, homepage_url: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 ${hasDuplicate ? 'border-red-300 bg-red-50/40 focus:ring-red-400' : 'border-gray-200 focus:ring-blue-400'}`}
              placeholder="可填网站、频道名、主页链接或备注"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">粉丝量级</label>
              <input
                type="text"
                value={form.followers}
                onChange={e => setForm(prev => ({ ...prev, followers: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="如 1.2M"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">国家/地区</label>
              {customCountry ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.country}
                    onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
                    className="min-w-0 flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="输入新国家/地区"
                  />
                  <button type="button" onClick={() => { setCustomCountry(false); setForm(prev => ({ ...prev, country: '' })) }} className="px-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">下拉</button>
                </div>
              ) : (
                <select
                  value={form.country}
                  onChange={e => {
                    if (e.target.value === '__custom__') {
                      setCustomCountry(true)
                      setForm(prev => ({ ...prev, country: '' }))
                      return
                    }
                    setForm(prev => ({ ...prev, country: e.target.value }))
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                >
                  <option value="">选择国家/地区</option>
                  {countryOptions.map(country => <option key={country} value={country}>{country}</option>)}
                  <option value="__custom__">+ 自定义输入</option>
                </select>
              )}
            </div>
          </div>

          {hasDuplicate && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 shadow-sm">
              <div className="font-semibold mb-1">检测到可能重复的 KOL，已阻止新增</div>
              <div className="space-y-1">
                {duplicateMatches.slice(0, 3).map(match => (
                  <div key={match.kol.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/70 px-2 py-1.5 border border-red-100">
                    <div>
                      <div className="font-medium text-red-800">{match.kol.name}</div>
                      <div className="text-xs text-red-600">匹配字段：{match.fields.join('、')}</div>
                    </div>
                    <div className="text-right text-xs text-red-500 shrink-0">
                      <div>{match.kol.platform || '-'}</div>
                      <div>{match.kol.email || match.kol.homepage_url || '-'}</div>
                    </div>
                  </div>
                ))}
                {duplicateMatches.length > 3 && (
                  <div className="text-xs text-red-500">还有 {duplicateMatches.length - 3} 条可能重复记录，请先搜索确认。</div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">领域标签</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {form.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-blue-800">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="输入标签后按回车"
              />
              <button type="button" onClick={() => addTag(tagInput)} className="px-3 py-2 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
                添加
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {TAGS.filter(t => !form.tags.includes(t)).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTag(t)}
                  className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs hover:bg-blue-50 hover:text-blue-600"
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
              取消
            </button>
            <button
              type="submit"
              disabled={!form.name.trim() || hasDuplicate}
              className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              确认新增
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
