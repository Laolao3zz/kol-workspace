import { useState } from 'react'
import { PLATFORMS, TAGS } from '../types'

interface Props {
  onClose: () => void
  onSubmit: (data: KolFormData) => void
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

export default function AddKolModal({ onClose, onSubmit }: Props) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
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
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
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
              type="url"
              value={form.homepage_url}
              onChange={e => setForm(prev => ({ ...prev, homepage_url: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
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
              <input
                type="text"
                value={form.country}
                onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="如 CN"
              />
            </div>
          </div>

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
              disabled={!form.name.trim()}
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
