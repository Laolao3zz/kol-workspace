import {
  Check,
  ExternalLink,
  Link2,
  ListPlus,
  Loader2,
  Plus,
  SkipForward,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { PLATFORMS } from '../types'
import type { KOL } from '../types'
import { findKolDuplicateMatches, hasBlockingKolDuplicate } from '../utils/kolDuplicate'
import { extractKolIntakeUrls } from '../utils/kolIntake'
import {
  analyzeKolProfileUrl,
  isUnresolvedContentUrl,
  normalizeProfileUrl,
  toSafeExternalUrl,
} from '../utils/profileUrl'
import { collectTagOptions } from '../utils/tags'
import TagSelector from './TagSelector'

type IntakeMode = 'single' | 'batch'

interface Props {
  onClose: () => void
  onSubmit: (data: KolFormData) => Promise<KOL>
  onOpenExisting: (kol: KOL) => void
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

interface BatchCandidate {
  id: string
  sourceUrl: string
  draft?: KolFormData
}

interface BatchSession {
  candidates: BatchCandidate[]
  total: number
}

const BATCH_STORAGE_KEY = 'kol-hub-batch-intake-v1'

const emptyForm = (): KolFormData => ({
  name: '',
  email: '',
  platform: 'YouTube',
  homepage_url: '',
  followers: '',
  country: '',
  tags: [],
  notes: '',
})

function loadBatchSession(): BatchSession {
  try {
    const saved = localStorage.getItem(BATCH_STORAGE_KEY)
    if (!saved) return { candidates: [], total: 0 }
    const parsed = JSON.parse(saved) as BatchSession
    if (!Array.isArray(parsed.candidates)) return { candidates: [], total: 0 }
    return {
      candidates: parsed.candidates.filter(candidate => candidate?.id && candidate?.sourceUrl),
      total: Math.max(Number(parsed.total) || 0, parsed.candidates.length),
    }
  } catch {
    return { candidates: [], total: 0 }
  }
}

function inferFormFromUrl(sourceUrl: string): { form: KolFormData; hint: string; error: boolean } {
  const nextForm = emptyForm()
  const analysis = analyzeKolProfileUrl(sourceUrl)

  if (!analysis) {
    return { form: { ...nextForm, homepage_url: sourceUrl }, hint: '暂时无法识别该链接，请手动填写平台和主页。', error: true }
  }

  if (analysis.kind === 'content' && !analysis.canonical_profile_url) {
    return {
      form: { ...nextForm, platform: analysis.platform, homepage_url: sourceUrl },
      hint: `这是 ${analysis.platform} 内容链接，链接中没有作者身份。请打开作者主页后粘贴主页链接。`,
      error: true,
    }
  }

  return {
    form: {
      ...nextForm,
      platform: analysis.platform,
      homepage_url: analysis.canonical_profile_url || analysis.original_url,
      name: analysis.name || '',
    },
    hint: analysis.kind === 'content'
      ? `已从内容链接提取 ${analysis.platform} 主页${analysis.name ? ` · ${analysis.name}` : ''}`
      : analysis.name
        ? `已识别 ${analysis.platform} · ${analysis.name}`
        : `已识别 ${analysis.platform} 链接`,
    error: false,
  }
}

export default function AddKolModal({
  onClose,
  onSubmit,
  onOpenExisting,
  existingKols,
  countryOptions,
}: Props) {
  const [mode, setMode] = useState<IntakeMode>('single')
  const [form, setForm] = useState<KolFormData>(emptyForm)
  const [profileUrlInput, setProfileUrlInput] = useState('')
  const [profileHint, setProfileHint] = useState('')
  const [profileHintError, setProfileHintError] = useState(false)
  const [customCountry, setCustomCountry] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [batchPaste, setBatchPaste] = useState('')
  const [batchSession, setBatchSession] = useState<BatchSession>(loadBatchSession)
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null)
  const [createdKols, setCreatedKols] = useState<KOL[]>([])

  const allKnownKols = useMemo(() => [...createdKols, ...existingKols], [createdKols, existingKols])
  const tagOptions = useMemo(
    () => collectTagOptions(allKnownKols.flatMap(kol => kol.tags || [])),
    [allKnownKols]
  )
  const duplicateMatches = useMemo(
    () => findKolDuplicateMatches(form, allKnownKols),
    [allKnownKols, form]
  )
  const blockingDuplicate = duplicateMatches.find(match => match.level === 'blocking')
  const hasBlockingDuplicate = hasBlockingKolDuplicate(duplicateMatches)
  const hasInvalidHomepage = isUnresolvedContentUrl(form.homepage_url)
  const activeCandidate = batchSession.candidates.find(candidate => candidate.id === activeCandidateId) || null
  const remainingCount = batchSession.candidates.length

  useEffect(() => {
    try {
      if (batchSession.candidates.length > 0) {
        localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batchSession))
      } else {
        localStorage.removeItem(BATCH_STORAGE_KEY)
      }
    } catch {
      // Storage can be unavailable in restricted browser sessions; intake still works until the modal closes.
    }
  }, [batchSession])

  useEffect(() => {
    if (mode !== 'batch' || !activeCandidateId) return
    setBatchSession(previous => ({
      ...previous,
      candidates: previous.candidates.map(candidate =>
        candidate.id === activeCandidateId ? { ...candidate, draft: form } : candidate
      ),
    }))
  }, [activeCandidateId, form, mode])

  const setProfileState = (sourceUrl: string, draft?: KolFormData) => {
    if (draft) {
      setForm(draft)
      setProfileUrlInput(draft.homepage_url || sourceUrl)
      setProfileHint('已恢复上次填写内容')
      setProfileHintError(isUnresolvedContentUrl(draft.homepage_url))
      setCustomCountry(Boolean(draft.country) && !countryOptions.includes(draft.country))
      return
    }

    const inferred = inferFormFromUrl(sourceUrl)
    setForm(inferred.form)
    setProfileUrlInput(inferred.form.homepage_url || sourceUrl)
    setProfileHint(inferred.hint)
    setProfileHintError(inferred.error)
    setCustomCountry(false)
  }

  const selectCandidate = (candidate: BatchCandidate) => {
    setActiveCandidateId(candidate.id)
    setSubmitError('')
    setProfileState(candidate.sourceUrl, candidate.draft)
  }

  const switchMode = (nextMode: IntakeMode) => {
    setMode(nextMode)
    setSubmitError('')
    if (nextMode === 'batch') {
      const candidate = batchSession.candidates.find(item => item.id === activeCandidateId) || batchSession.candidates[0]
      if (candidate) selectCandidate(candidate)
    } else {
      setForm(emptyForm())
      setProfileUrlInput('')
      setProfileHint('')
      setProfileHintError(false)
      setCustomCountry(false)
    }
  }

  const applyProfileUrl = () => {
    const rawUrl = profileUrlInput || form.homepage_url
    const inferred = inferFormFromUrl(rawUrl)
    setForm(previous => ({
      ...previous,
      ...inferred.form,
      name: previous.name.trim() ? previous.name : inferred.form.name,
      email: previous.email,
      followers: previous.followers,
      country: previous.country,
      tags: previous.tags,
      notes: previous.notes,
    }))
    setProfileUrlInput(inferred.form.homepage_url || rawUrl)
    setProfileHint(inferred.hint)
    setProfileHintError(inferred.error)
  }

  const importBatchLinks = () => {
    const urls = extractKolIntakeUrls(batchPaste)
    if (urls.length === 0) {
      setSubmitError('没有识别到可用链接，请检查粘贴内容。')
      return
    }

    const queuedIdentities = new Set(batchSession.candidates.map(candidate => normalizeProfileUrl(candidate.sourceUrl)))
    const freshUrls = urls.filter(url => !queuedIdentities.has(normalizeProfileUrl(url)))
    if (freshUrls.length === 0) {
      setSubmitError('这些链接已经在当前队列中。')
      return
    }

    const timestamp = Date.now()
    const newCandidates = freshUrls.map((sourceUrl, index) => ({
      id: `batch-${timestamp}-${index}`,
      sourceUrl,
    }))
    const firstCandidate = activeCandidate || newCandidates[0]

    setBatchSession(previous => ({
      candidates: [...previous.candidates, ...newCandidates],
      total: previous.candidates.length === 0 ? newCandidates.length : previous.total + newCandidates.length,
    }))
    setBatchPaste('')
    setSubmitError('')
    if (!activeCandidate) selectCandidate(firstCandidate)
  }

  const removeActiveCandidate = () => {
    if (!activeCandidateId) return
    const currentIndex = batchSession.candidates.findIndex(candidate => candidate.id === activeCandidateId)
    const candidates = batchSession.candidates.filter(candidate => candidate.id !== activeCandidateId)
    const nextCandidate = candidates[Math.min(currentIndex, candidates.length - 1)] || null

    setBatchSession(previous => ({ ...previous, candidates }))
    setActiveCandidateId(nextCandidate?.id || null)
    setSubmitError('')
    if (nextCandidate) {
      setProfileState(nextCandidate.sourceUrl, nextCandidate.draft)
    } else {
      setForm(emptyForm())
      setProfileUrlInput('')
      setProfileHint('')
      setProfileHintError(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim() || hasBlockingDuplicate || hasInvalidHomepage || submitting) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const created = await onSubmit(form)
      setCreatedKols(previous => [created, ...previous])
      if (mode === 'batch') {
        removeActiveCandidate()
      } else {
        onClose()
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '创建失败，请重试。')
    } finally {
      setSubmitting(false)
    }
  }

  const getCandidateDuplicate = (candidate: BatchCandidate) => {
    const inferred = candidate.draft || inferFormFromUrl(candidate.sourceUrl).form
    return findKolDuplicateMatches(inferred, allKnownKols).find(match => match.level === 'blocking')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative mx-4 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[16px] border border-black/[0.08] bg-white shadow-2xl ${mode === 'batch' ? 'max-w-6xl' : 'max-w-2xl'}`}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-black/[0.06] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#1D1D1F] text-white">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#1D1D1F]">新增 KOL</h2>
              <p className="mt-1 text-xs font-medium text-[#86868B]">逐条确认后才会写入资源池，未完成内容保留在当前浏览器。</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-black/[0.08] text-[#86868B] hover:bg-[#F5F5F7]" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-black/[0.06] px-6 py-3">
          <div className="inline-flex rounded-[9px] bg-[#F1F2F4] p-1">
            <ModeButton active={mode === 'single'} onClick={() => switchMode('single')} icon={<UserPlus className="h-3.5 w-3.5" />}>单个录入</ModeButton>
            <ModeButton active={mode === 'batch'} onClick={() => switchMode('batch')} icon={<ListPlus className="h-3.5 w-3.5" />}>批量录入</ModeButton>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {mode === 'batch' && (
            <aside className="flex w-[320px] shrink-0 flex-col border-r border-black/[0.07] bg-[#F8F9FA]">
              <div className="border-b border-black/[0.06] p-4">
                <label className="mb-2 block text-xs font-bold text-[#3A3A3C]">粘贴主页链接</label>
                <textarea
                  value={batchPaste}
                  onChange={event => { setBatchPaste(event.target.value); setSubmitError('') }}
                  rows={4}
                  className="w-full resize-none rounded-[8px] border border-black/[0.1] bg-white px-3 py-2 text-xs font-medium leading-5 outline-none focus:border-[#0066FF]/50"
                  placeholder={'可直接粘贴 AI 输出的整段内容\n支持一次识别多个链接'}
                />
                <button type="button" onClick={importBatchLinks} className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] bg-[#1D1D1F] text-xs font-bold text-white hover:bg-black">
                  <Plus className="h-3.5 w-3.5" /> 加入待处理队列
                </button>
              </div>

              <div className="flex items-center justify-between px-4 pb-2 pt-4">
                <span className="text-xs font-extrabold text-[#3A3A3C]">待处理链接</span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#6E6E73] shadow-sm">剩余 {remainingCount} / {batchSession.total}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
                {batchSession.candidates.map((candidate, index) => {
                  const duplicate = getCandidateDuplicate(candidate)
                  const selected = candidate.id === activeCandidateId
                  const analysis = analyzeKolProfileUrl(candidate.sourceUrl)
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => selectCandidate(candidate)}
                      className={`flex w-full items-start gap-3 rounded-[8px] border px-3 py-2.5 text-left transition ${selected ? 'border-[#0066FF]/25 bg-white shadow-sm' : 'border-transparent hover:bg-white/80'}`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[10px] font-extrabold ${selected ? 'bg-[#0066FF] text-white' : 'bg-[#E8E9EC] text-[#6E6E73]'}`}>{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-[#1D1D1F]">{candidate.draft?.name || analysis?.name || analysis?.platform || '待识别链接'}</span>
                          {duplicate && <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[9px] font-extrabold text-red-600">已存在</span>}
                        </span>
                        <span className="mt-1 block truncate text-[10px] font-medium text-[#86868B]">{candidate.sourceUrl}</span>
                      </span>
                    </button>
                  )
                })}
                {remainingCount === 0 && (
                  <div className="mx-2 mt-3 rounded-[8px] border border-dashed border-black/[0.12] px-4 py-8 text-center">
                    <Check className="mx-auto h-5 w-5 text-[#34A853]" />
                    <p className="mt-2 text-xs font-bold text-[#3A3A3C]">当前队列已处理完</p>
                    <p className="mt-1 text-[10px] text-[#86868B]">继续粘贴链接即可开始下一批</p>
                  </div>
                )}
              </div>
            </aside>
          )}

          <div className="min-w-0 flex-1 overflow-y-auto">
            {mode === 'batch' && !activeCandidate ? (
              <div className="flex h-full min-h-[480px] items-center justify-center px-8 text-center">
                <div>
                  <Link2 className="mx-auto h-7 w-7 text-[#AEAEB2]" />
                  <h3 className="mt-3 text-sm font-extrabold text-[#3A3A3C]">先把链接加入左侧队列</h3>
                  <p className="mt-1 text-xs text-[#86868B]">系统会逐条打开同一份 KOL 表单供你确认。</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 p-6">
                <div className="rounded-[10px] border border-blue-100 bg-blue-50/70 p-4">
                  <label className="mb-2 flex items-center gap-2 text-xs font-extrabold text-[#0066FF]">
                    <Sparkles className="h-3.5 w-3.5" /> 主页链接快速识别
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={profileUrlInput}
                      onChange={event => {
                        setProfileUrlInput(event.target.value)
                        setProfileHint('')
                        setProfileHintError(false)
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          applyProfileUrl()
                        }
                      }}
                      className="h-10 min-w-0 flex-1 rounded-[8px] border border-blue-100 bg-white px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
                      placeholder="粘贴 YouTube / TikTok / Instagram / X 主页或内容链接"
                    />
                    <button type="button" onClick={applyProfileUrl} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-[#0066FF] px-4 text-xs font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.25)]">
                      <Sparkles className="h-3.5 w-3.5" /> 识别
                    </button>
                    {mode === 'batch' && activeCandidate && toSafeExternalUrl(activeCandidate.sourceUrl) && (
                      <a href={toSafeExternalUrl(activeCandidate.sourceUrl) || undefined} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-blue-100 bg-white px-3 text-xs font-bold text-[#0066FF] hover:bg-blue-50">
                        <ExternalLink className="h-3.5 w-3.5" /> 打开原链接
                      </a>
                    )}
                  </div>
                  <p className={`mt-2 text-[11px] font-semibold ${profileHintError ? 'text-red-700' : 'text-blue-700/80'}`}>
                    {profileHint || '可自动填入平台、主页和可识别的 handle；粉丝数与邮箱仍需人工确认。'}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">博主名称 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))}
                    className={`h-10 w-full rounded-[8px] border px-3 text-sm font-semibold outline-none ${hasBlockingDuplicate ? 'border-red-300 bg-red-50/40 focus:border-red-400' : 'border-black/[0.08] focus:border-[#0066FF]/40'}`}
                    placeholder="必填"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">联系邮箱</label>
                    <input type="email" value={form.email} onChange={event => setForm(previous => ({ ...previous, email: event.target.value }))} className={`h-10 w-full rounded-[8px] border px-3 text-sm font-semibold outline-none ${hasBlockingDuplicate ? 'border-red-300 bg-red-50/40' : 'border-black/[0.08] focus:border-[#0066FF]/40'}`} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">核心平台</label>
                    <select value={form.platform} onChange={event => setForm(previous => ({ ...previous, platform: event.target.value }))} className="h-10 w-full rounded-[8px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40">
                      {PLATFORMS.map(platform => <option key={platform} value={platform}>{platform}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">主页链接</label>
                  <input type="text" value={form.homepage_url} onChange={event => setForm(previous => ({ ...previous, homepage_url: event.target.value }))} className={`h-10 w-full rounded-[8px] border px-3 text-sm font-semibold outline-none ${hasBlockingDuplicate || hasInvalidHomepage ? 'border-red-300 bg-red-50/40' : 'border-black/[0.08] focus:border-[#0066FF]/40'}`} placeholder="KOL 主页或频道链接" />
                  {hasInvalidHomepage && <p className="mt-1.5 text-[11px] font-semibold text-red-600">该内容链接无法确认作者身份，请改为 KOL 主页或频道链接。</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">粉丝量级</label>
                    <input type="text" value={form.followers} onChange={event => setForm(previous => ({ ...previous, followers: event.target.value }))} className="h-10 w-full rounded-[8px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40" placeholder="如 1.2M" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">国家/地区</label>
                    {customCountry ? (
                      <div className="flex gap-2">
                        <input type="text" value={form.country} onChange={event => setForm(previous => ({ ...previous, country: event.target.value }))} className="h-10 min-w-0 flex-1 rounded-[8px] border border-black/[0.08] px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40" placeholder="输入新国家/地区" />
                        <button type="button" onClick={() => { setCustomCountry(false); setForm(previous => ({ ...previous, country: '' })) }} className="rounded-[8px] border border-black/[0.08] px-3 text-xs font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">下拉</button>
                      </div>
                    ) : (
                      <select
                        value={form.country}
                        onChange={event => {
                          if (event.target.value === '__custom__') {
                            setCustomCountry(true)
                            setForm(previous => ({ ...previous, country: '' }))
                          } else {
                            setForm(previous => ({ ...previous, country: event.target.value }))
                          }
                        }}
                        className="h-10 w-full rounded-[8px] border border-black/[0.08] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0066FF]/40"
                      >
                        <option value="">选择国家/地区</option>
                        {countryOptions.map(country => <option key={country} value={country}>{country}</option>)}
                        <option value="__custom__">+ 自定义输入</option>
                      </select>
                    )}
                  </div>
                </div>

                {duplicateMatches.length > 0 && (
                  <div className={`rounded-[10px] border px-3 py-2.5 text-sm ${hasBlockingDuplicate ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{hasBlockingDuplicate ? '该 KOL 已存在，已阻止重复新增' : '发现可能重复记录，请确认后再新增'}</div>
                        <div className="mt-1 text-xs opacity-80">{duplicateMatches.slice(0, 3).map(match => `${match.kol.name}（${match.fields.join('、')}）`).join('；')}</div>
                      </div>
                      {blockingDuplicate && (
                        <button type="button" onClick={() => onOpenExisting(blockingDuplicate.kol)} className="shrink-0 rounded-[7px] border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">查看已有 KOL</button>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">领域标签</label>
                  <TagSelector value={form.tags} options={tagOptions} onChange={tags => setForm(previous => ({ ...previous, tags }))} placeholder="搜索现有标签，或输入新标签" />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">KOL 备注</label>
                  <textarea value={form.notes} onChange={event => setForm(previous => ({ ...previous, notes: event.target.value }))} rows={3} className="w-full resize-y rounded-[8px] border border-black/[0.08] px-3 py-2 text-sm font-semibold outline-none focus:border-[#0066FF]/40" placeholder="沟通偏好、内容特点、合作注意事项..." />
                </div>

                {submitError && <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{submitError}</div>}

                <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-4">
                  {mode === 'batch' ? (
                    <>
                      <button type="button" onClick={removeActiveCandidate} disabled={submitting} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] px-4 text-sm font-bold text-[#6E6E73] hover:bg-[#F5F5F7] disabled:opacity-50"><SkipForward className="h-4 w-4" /> 不添加</button>
                      <button type="submit" disabled={!form.name.trim() || hasBlockingDuplicate || hasInvalidHomepage || submitting} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} 添加并下一个
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={onClose} className="h-10 rounded-[8px] px-4 text-sm font-bold text-[#6E6E73] hover:bg-[#F5F5F7]">取消</button>
                      <button type="submit" disabled={!form.name.trim() || hasBlockingDuplicate || hasInvalidHomepage || submitting} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-[#0066FF] px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(0,102,255,0.3)] disabled:cursor-not-allowed disabled:opacity-50">
                        {submitting && <Loader2 className="h-4 w-4 animate-spin" />} 确认新增
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ModeButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-xs font-bold transition ${active ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}>
      {icon}{children}
    </button>
  )
}
