import { Sparkles, UserPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PLATFORMS } from '../types'
import type { KOL } from '../types'
import { inferKolProfileFromUrl, normalizeProfileUrl } from '../utils/profileUrl'
import { collectTagOptions } from '../utils/tags'
import TagSelector from './TagSelector'

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
  notes: string
}

type DuplicateMatch = {
  kol: KOL
  fields: string[]
}

const normalizeText = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
const normalizeEmail = (value: string) => value.trim().toLowerCase()

const normalizeChannelUrl = (value: string) => {
  return normalizeProfileUrl(value)
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
    notes: '',
  })
  const [profileUrlInput, setProfileUrlInput] = useState('')
  const [profileHint, setProfileHint] = useState('')
  const [customCountry, setCustomCountry] = useState(false)
  const tagOptions = useMemo(
    () => collectTagOptions(existingKols.flatMap(kol => kol.tags || [])),
    [existingKols]
  )

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

  const applyProfileUrl = () => {
    const inferred = inferKolProfileFromUrl(profileUrlInput || form.homepage_url)
    if (!inferred) {
      setProfileHint('暂时无法识别该链接，请手动填写平台和主页。')
      return
    }

    setForm(prev => ({
      ...prev,
      platform: inferred.platform,
      homepage_url: inferred.homepage_url,
      name: prev.name.trim() ? prev.name : inferred.name || prev.name,
    }))
    setProfileUrlInput(inferred.homepage_url)
    setProfileHint(inferred.name ? `已识别 ${inferred.platform} · ${inferred.name}` : `已识别 ${inferred.platform} 链接`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || hasDuplicate) return
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[20px] border border-black/[0.06] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#1D1D1F] text-white">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#1D1D1F]">新增 KOL</h2>
              <p className="mt-1 text-xs font-medium text-[#86868B]">先粘贴主页链接可自动推断平台和 handle。</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-black/[0.08] text-[#86868B] hover:bg-[#F5F5F7]" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-[16px] border border-blue-100 bg-blue-50/70 p-4">
            <label className="mb-2 flex items-center gap-2 text-xs font-extrabold text-[#0066FF]">
              <Sparkles className="h-3.5 w-3.5" /> 主页链接快速识别
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={profileUrlInput}
                onChange={e => {
                  setProfileUrlInput(e.target.value)
                  setProfileHint('')
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyProfileUrl()
                  }
                }}
                className="h-10 min-w-0 flex-1 rounded-[10px] border border-blue-100 bg-white px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
                placeholder="粘贴 YouTube / TikTok / Instagram / X 主页或视频链接"
              />
              <button type="button" onClick={applyProfileUrl} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[#0066FF] px-4 text-xs font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.25)]">
                <Sparkles className="h-3.5 w-3.5" />
                识别
              </button>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-blue-700/80">
              {profileHint || '轻量识别会填入平台、主页链接和可识别的 handle；粉丝数/邮箱仍需人工确认。'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              博主名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className={`h-10 w-full rounded-[10px] border px-3 text-sm font-semibold outline-none ${hasDuplicate ? 'border-red-300 bg-red-50/40 focus:border-red-400' : 'border-black/[0.08] focus:border-[#0066FF]/40'}`}
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
                className={`h-10 w-full rounded-[10px] border px-3 text-sm font-semibold outline-none ${hasDuplicate ? 'border-red-300 bg-red-50/40 focus:border-red-400' : 'border-black/[0.08] focus:border-[#0066FF]/40'}`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">核心平台</label>
              <select
                value={form.platform}
                onChange={e => setForm(prev => ({ ...prev, platform: e.target.value }))}
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
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
              className={`h-10 w-full rounded-[10px] border px-3 text-sm font-semibold outline-none ${hasDuplicate ? 'border-red-300 bg-red-50/40 focus:border-red-400' : 'border-black/[0.08] focus:border-[#0066FF]/40'}`}
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
                className="h-10 w-full rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
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
                    className="h-10 min-w-0 flex-1 rounded-[10px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
                    placeholder="输入新国家/地区"
                  />
                  <button type="button" onClick={() => { setCustomCountry(false); setForm(prev => ({ ...prev, country: '' })) }} className="rounded-[10px] border border-black/[0.08] px-3 text-xs font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">下拉</button>
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
                  className="h-10 w-full rounded-[10px] border border-black/[0.08] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
                >
                  <option value="">选择国家/地区</option>
                  {countryOptions.map(country => <option key={country} value={country}>{country}</option>)}
                  <option value="__custom__">+ 自定义输入</option>
                </select>
              )}
            </div>
          </div>

          {hasDuplicate && (
            <div className="rounded-[14px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 shadow-sm">
              <div className="font-semibold mb-1">检测到可能重复的 KOL，已阻止新增</div>
              <div className="space-y-1">
                {duplicateMatches.slice(0, 3).map(match => (
                  <div key={match.kol.id} className="flex items-start justify-between gap-3 rounded-[10px] border border-red-100 bg-white/70 px-2 py-1.5">
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
            <TagSelector
              value={form.tags}
              options={tagOptions}
              onChange={tags => setForm(prev => ({ ...prev, tags }))}
              placeholder="搜索现有标签，或输入新标签"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">KOL 备注</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full rounded-[10px] border border-black/[0.08] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0066FF]/40 resize-y"
              placeholder="沟通偏好、内容特点、合作注意事项..."
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-4">
            <button type="button" onClick={onClose} className="h-10 rounded-[10px] px-4 text-sm font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">
              取消
            </button>
            <button
              type="submit"
              disabled={!form.name.trim() || hasDuplicate}
              className="h-10 rounded-[10px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              确认新增
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
