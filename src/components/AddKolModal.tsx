import { Sparkles, UserPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PLATFORMS } from '../types'
import type { KOL } from '../types'
import { analyzeKolProfileUrl, isUnresolvedContentUrl } from '../utils/profileUrl'
import { findKolDuplicateMatches, hasBlockingKolDuplicate } from '../utils/kolDuplicate'
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
  const [profileHintError, setProfileHintError] = useState(false)
  const [customCountry, setCustomCountry] = useState(false)
  const tagOptions = useMemo(
    () => collectTagOptions(existingKols.flatMap(kol => kol.tags || [])),
    [existingKols]
  )

  const duplicateMatches = useMemo(
    () => findKolDuplicateMatches(form, existingKols),
    [existingKols, form]
  )
  const hasBlockingDuplicate = hasBlockingKolDuplicate(duplicateMatches)
  const hasInvalidHomepage = isUnresolvedContentUrl(form.homepage_url)

  const applyProfileUrl = () => {
    const rawUrl = profileUrlInput || form.homepage_url
    const analysis = analyzeKolProfileUrl(rawUrl)
    if (!analysis) {
      setProfileHintError(true)
      setProfileHint('暂时无法识别该链接，请手动填写平台和主页。')
      return
    }
    if (analysis.kind === 'content' && !analysis.canonical_profile_url) {
      setProfileHintError(true)
      setProfileHint(`这是 ${analysis.platform} 内容链接，链接中没有作者身份。请打开作者主页后复制主页链接。`)
      return
    }

    const homepageUrl = analysis.canonical_profile_url || analysis.original_url

    setForm(prev => ({
      ...prev,
      platform: analysis.platform,
      homepage_url: homepageUrl,
      name: prev.name.trim() ? prev.name : analysis.name || prev.name,
    }))
    setProfileUrlInput(homepageUrl)
    setProfileHintError(false)
    setProfileHint(analysis.kind === 'content'
      ? `已从内容链接提取 ${analysis.platform} 主页${analysis.name ? ` · ${analysis.name}` : ''}`
      : analysis.name
        ? `已识别 ${analysis.platform} · ${analysis.name}`
        : `已识别 ${analysis.platform} 链接`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || hasBlockingDuplicate || hasInvalidHomepage) return
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
                  setProfileHintError(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyProfileUrl()
                  }
                }}
                className="h-10 min-w-0 flex-1 rounded-[10px] border border-blue-100 bg-white px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
                placeholder="粘贴 YouTube / TikTok / Instagram / X 主页或内容链接"
              />
              <button type="button" onClick={applyProfileUrl} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-[#0066FF] px-4 text-xs font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.25)]">
                <Sparkles className="h-3.5 w-3.5" />
                识别
              </button>
            </div>
            <p className={`mt-2 text-[11px] font-semibold ${profileHintError ? 'text-red-700' : 'text-blue-700/80'}`}>
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
              className={`h-10 w-full rounded-[10px] border px-3 text-sm font-semibold outline-none ${hasBlockingDuplicate ? 'border-red-300 bg-red-50/40 focus:border-red-400' : 'border-black/[0.08] focus:border-[#0066FF]/40'}`}
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
                className={`h-10 w-full rounded-[10px] border px-3 text-sm font-semibold outline-none ${hasBlockingDuplicate ? 'border-red-300 bg-red-50/40 focus:border-red-400' : 'border-black/[0.08] focus:border-[#0066FF]/40'}`}
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
              className={`h-10 w-full rounded-[10px] border px-3 text-sm font-semibold outline-none ${hasBlockingDuplicate || hasInvalidHomepage ? 'border-red-300 bg-red-50/40 focus:border-red-400' : 'border-black/[0.08] focus:border-[#0066FF]/40'}`}
              placeholder="可填网站、频道名、主页链接或备注"
            />
            {hasInvalidHomepage && (
              <p className="mt-1.5 text-[11px] font-semibold text-red-600">这是内容链接，无法确认作者身份。请粘贴该 KOL 的主页或频道链接。</p>
            )}
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

          {duplicateMatches.length > 0 && (
            <div className={`rounded-[14px] border px-3 py-2.5 text-sm shadow-sm ${hasBlockingDuplicate ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <div className="mb-1 font-semibold">{hasBlockingDuplicate ? '检测到重复 KOL，已阻止新增' : '发现可能重复记录，请确认后再新增'}</div>
              <div className="space-y-1">
                {duplicateMatches.slice(0, 3).map(match => (
                  <div key={match.kol.id} className={`flex items-start justify-between gap-3 rounded-[10px] border bg-white/70 px-2 py-1.5 ${match.level === 'blocking' ? 'border-red-100' : 'border-amber-100'}`}>
                    <div>
                      <div className="font-medium">{match.kol.name}</div>
                      <div className="text-xs opacity-80">匹配字段：{match.fields.join('、')} · {match.level === 'blocking' ? '确定重复' : '仅提醒'}</div>
                    </div>
                    <div className="shrink-0 text-right text-xs opacity-70">
                      <div>{match.kol.platform || '-'}</div>
                      <div>{match.kol.email || match.kol.homepage_url || '-'}</div>
                    </div>
                  </div>
                ))}
                {duplicateMatches.length > 3 && (
                  <div className="text-xs opacity-75">还有 {duplicateMatches.length - 3} 条匹配记录，请先搜索确认。</div>
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
              disabled={!form.name.trim() || hasBlockingDuplicate || hasInvalidHomepage}
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
