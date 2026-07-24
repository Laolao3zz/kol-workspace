import { type FormEvent, useEffect, useState } from 'react'
import { LogOut, Mail, Save, UserRound, X } from 'lucide-react'
import { validateUsername } from '../auth/userProfile'

interface AccountSettingsModalProps {
  email: string
  username: string
  onClose: () => void
  onSave: (username: string) => Promise<void>
  onSignOut: () => void
}

export default function AccountSettingsModal({
  email,
  username,
  onClose,
  onSave,
  onSignOut,
}: AccountSettingsModalProps) {
  const [value, setValue] = useState(username)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const validationError = validateUsername(value)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave(value.trim())
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '用户名保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="w-full rounded-t-[8px] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-[8px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="account-settings-title" className="text-lg font-extrabold text-[#1D1D1F]">账号设置</h2>
            <p className="mt-1 text-xs font-medium text-[#86868B]">用户名会显示在工作台中</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[#86868B] hover:bg-[#F4F5F7]" title="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-[#525257]">用户名</span>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEAEB2]" />
              <input
                autoFocus
                type="text"
                value={value}
                onChange={event => setValue(event.target.value)}
                minLength={2}
                maxLength={30}
                required
                autoComplete="name"
                className="h-12 w-full rounded-[8px] border border-black/[0.09] bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#0066FF]/60 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-[#525257]">公司邮箱</span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEAEB2]" />
              <input type="email" value={email} readOnly className="h-12 w-full rounded-[8px] border border-black/[0.06] bg-[#F4F5F7] pl-10 pr-3 text-sm font-semibold text-[#6E6E73] outline-none" />
            </div>
          </label>

          {error && <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">{error}</div>}

          <button type="submit" disabled={saving || value.trim() === username.trim()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0066FF] px-4 text-sm font-extrabold text-white hover:bg-[#0059DF] disabled:cursor-not-allowed disabled:opacity-50">
            <Save className="h-4 w-4" />
            {saving ? '正在保存...' : '保存用户名'}
          </button>
        </form>

        <button type="button" onClick={onSignOut} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-black/[0.08] text-sm font-bold text-[#525257] hover:bg-[#F4F5F7]">
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </section>
    </div>
  )
}
