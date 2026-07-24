import type { Session } from '@supabase/supabase-js'
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { getSupabase, hasSupabaseConfig } from '../lib/supabase'
import youyeetooLogo from '../assets/youyeetoo-logo.png'
import { readUsername, validateUsername } from './userProfile'

type AuthAction = 'invite' | 'recovery' | null

interface AuthContextValue {
  email: string
  username: string
  isDemo: boolean
  updateUsername: (username: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readInitialAuthAction(): AuthAction {
  if (typeof window === 'undefined') return null
  const hashType = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type')
  const queryType = new URLSearchParams(window.location.search).get('type')
  const type = hashType || queryType
  return type === 'invite' || type === 'recovery' ? type : null
}

function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '')
  if (/invalid login credentials/i.test(message)) return '邮箱或密码不正确'
  if (/email not confirmed/i.test(message)) return '账号尚未完成邮箱确认，请联系管理员'
  if (/rate limit/i.test(message)) return '操作过于频繁，请稍后再试'
  if (/password should be at least/i.test(message)) return '密码至少需要 6 位'
  return message || '操作失败，请稍后重试'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const demo = import.meta.env.VITE_USE_DEMO_DATA === 'true'
  const configured = hasSupabaseConfig()
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(!demo && configured)
  const [authAction, setAuthAction] = useState<AuthAction>(readInitialAuthAction)

  useEffect(() => {
    if (demo || !configured) return

    const supabase = getSupabase()
    let active = true

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error('[auth] Failed to restore session', error)
      setSession(data.session)
      setChecking(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') setAuthAction('recovery')
      setSession(nextSession)
      setChecking(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [configured, demo])

  const value = useMemo<AuthContextValue>(() => ({
    email: demo ? '本地演示模式' : session?.user.email || '内部账号',
    username: demo ? '演示账号' : readUsername(session?.user.user_metadata),
    isDemo: demo,
    updateUsername: async (username: string) => {
      if (demo) return
      const validationError = validateUsername(username)
      if (validationError) throw new Error(validationError)
      const { error } = await getSupabase().auth.updateUser({
        data: { username: username.trim() },
      })
      if (error) throw new Error(authErrorMessage(error))
    },
    signOut: async () => {
      if (demo) return
      const { error } = await getSupabase().auth.signOut({ scope: 'local' })
      if (error) throw error
    },
  }), [demo, session?.user.email, session?.user.user_metadata])

  if (checking) return <AuthLoading />
  if (!demo && !configured) return <AuthConfigurationError />
  if (!demo && (!session || authAction)) {
    if (session && authAction) {
      return <SetPasswordScreen action={authAction} onComplete={() => setAuthAction(null)} />
    }
    return <LoginScreen />
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function AuthConfigurationError() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F4F5F7] px-5 text-[#1D1D1F]">
      <div className="w-full max-w-md rounded-[8px] border border-red-200 bg-white p-6 shadow-sm">
        <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-red-50 text-red-700">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-xl font-extrabold">访问配置未完成</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-[#6E6E73]">
          当前环境缺少 Supabase 地址或匿名密钥。为避免绕过公司登录，应用已停止加载业务数据。
        </p>
      </div>
    </main>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

function AuthLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F4F5F7] text-[#1D1D1F]">
      <div className="flex items-center gap-3 text-sm font-bold">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#D5D7DB] border-t-[#0066FF]" />
        正在验证访问权限
      </div>
    </div>
  )
}

function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')

    try {
      if (mode === 'forgot') {
        const redirectTo = `${window.location.origin}${window.location.pathname}`
        const { error: resetError } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo })
        if (resetError) throw resetError
        setNotice('重置邮件已发送，请检查公司邮箱。')
      } else {
        const { error: loginError } = await getSupabase().auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (loginError) throw loginError
      }
    } catch (submitError) {
      setError(authErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] bg-[#F4F5F7] text-[#1D1D1F]">
      <section className="hidden w-[42%] min-w-[420px] flex-col justify-between bg-[#17181B] p-12 text-white lg:flex">
        <Brand inverse />
        <div className="max-w-md">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-[8px] border border-white/15 bg-white/10">
            <ShieldCheck className="h-5 w-5 text-[#64A2FF]" />
          </div>
          <h1 className="text-[34px] font-extrabold leading-tight">公司内部协作空间</h1>
          <p className="mt-4 text-sm font-medium leading-7 text-white/55">
            KOL 资源、沟通进度与合作数据统一沉淀，仅向管理员授权的成员开放。
          </p>
        </div>
        <p className="text-xs font-semibold text-white/35">Youyeetoo KOL Hub · Internal Access</p>
      </section>

      <section className="flex min-w-0 flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <div className="mb-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[8px] border border-black/[0.07] bg-white shadow-sm">
              {mode === 'login' ? <LockKeyhole className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
            </div>
            <h2 className="text-2xl font-extrabold">{mode === 'login' ? '登录 Youyeetoo KOL Hub' : '找回密码'}</h2>
            <p className="mt-2 text-sm font-medium text-[#6E6E73]">
              {mode === 'login' ? '使用管理员分配的公司账号继续' : '重置链接将发送到已开通的公司邮箱'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-[#525257]">公司邮箱</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEAEB2]" />
                <input
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="name@company.com"
                  className="h-12 w-full rounded-[8px] border border-black/[0.09] bg-white pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-[#0066FF]/60 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </label>

            {mode === 'login' && (
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-[#525257]">密码</span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEAEB2]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-12 w-full rounded-[8px] border border-black/[0.09] bg-white pl-10 pr-11 text-sm font-semibold outline-none transition focus:border-[#0066FF]/60 focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#86868B] hover:bg-[#F4F5F7]"
                    title={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            )}

            {error && <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">{error}</div>}
            {notice && <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">{notice}</div>}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0066FF] px-4 text-sm font-extrabold text-white shadow-[0_5px_16px_rgba(0,102,255,0.24)] transition hover:bg-[#0059DF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? '请稍候...' : mode === 'login' ? '登录' : '发送重置邮件'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(current => current === 'login' ? 'forgot' : 'login')
              setError('')
              setNotice('')
            }}
            className="mt-5 text-sm font-bold text-[#0066FF] hover:text-[#004FC4]"
          >
            {mode === 'login' ? '忘记密码？' : '返回登录'}
          </button>

          <div className="mt-10 border-t border-black/[0.07] pt-5 text-xs font-medium leading-5 text-[#86868B]">
            没有账号？请联系管理员开通。系统不开放自助注册。
          </div>
        </div>
      </section>
    </main>
  )
}

function SetPasswordScreen({ action, onComplete }: { action: Exclude<AuthAction, null>; onComplete: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (action === 'invite') {
      const usernameError = validateUsername(username)
      if (usernameError) {
        setError(usernameError)
        return
      }
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    if (password.length < 8) {
      setError('密码至少需要 8 位')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({
        password,
        ...(action === 'invite' ? { data: { username: username.trim() } } : {}),
      })
      if (updateError) throw updateError
      window.history.replaceState({}, document.title, window.location.pathname)
      onComplete()
    } catch (updateError) {
      setError(authErrorMessage(updateError))
    } finally {
      setSubmitting(false)
    }
  }

  const returnToLogin = async () => {
    await getSupabase().auth.signOut({ scope: 'local' })
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F4F5F7] px-5 py-10 text-[#1D1D1F]">
      <div className="w-full max-w-[400px]">
        <div className="mb-10"><Brand /></div>
        <div className="mb-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[8px] bg-[#1D1D1F] text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-extrabold">{action === 'invite' ? '完善账号信息' : '设置新密码'}</h1>
          <p className="mt-2 text-sm font-medium text-[#6E6E73]">{action === 'invite' ? '设置用户名和登录密码后进入公司工作台' : '完成后即可进入公司工作台'}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {action === 'invite' && (
            <label className="block">
              <span className="mb-2 block text-xs font-bold text-[#525257]">用户名</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEAEB2]" />
                <input
                  type="text"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  required
                  minLength={2}
                  maxLength={30}
                  autoComplete="name"
                  placeholder="例如：老朱"
                  className="h-12 w-full rounded-[8px] border border-black/[0.09] bg-white pl-10 pr-3 text-sm font-semibold outline-none focus:border-[#0066FF]/60 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </label>
          )}
          <PasswordInput label="新密码" value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordInput label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          {error && <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">{error}</div>}
          <button type="submit" disabled={submitting} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#0066FF] text-sm font-extrabold text-white disabled:opacity-60">
            {submitting ? '正在保存...' : '保存并进入'} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
        <button type="button" onClick={() => void returnToLogin()} className="mt-5 text-sm font-bold text-[#6E6E73] hover:text-[#1D1D1F]">返回登录</button>
      </div>
    </main>
  )
}

function PasswordInput({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-[#525257]">{label}</span>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEAEB2]" />
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={event => onChange(event.target.value)}
          required
          autoComplete={autoComplete}
          className="h-12 w-full rounded-[8px] border border-black/[0.09] bg-white pl-10 pr-11 text-sm font-semibold outline-none focus:border-[#0066FF]/60 focus:ring-4 focus:ring-blue-100"
        />
        <button type="button" onClick={() => setVisible(current => !current)} className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#86868B] hover:bg-[#F4F5F7]" title={visible ? '隐藏密码' : '显示密码'}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  )
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={inverse ? 'w-fit rounded-[8px] bg-white px-4 py-3' : 'w-fit'}>
      <img src={youyeetooLogo} alt="Youyeetoo 风火轮机器人 Logo" className="h-auto w-[190px] sm:w-[220px]" />
      <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-black/[0.07] pt-2">
        <div className="text-[13px] font-extrabold text-[#1D1D1F]">Youyeetoo KOL Hub</div>
        <div className="text-[10px] font-semibold text-[#86868B]">品牌合作管理</div>
      </div>
    </div>
  )
}
