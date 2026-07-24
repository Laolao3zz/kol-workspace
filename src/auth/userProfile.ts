const USERNAME_MIN_LENGTH = 2
const USERNAME_MAX_LENGTH = 30

export function readUsername(metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return ''

  const candidates = [metadata.username, metadata.display_name, metadata.full_name, metadata.name]
  const value = candidates.find(candidate => typeof candidate === 'string' && candidate.trim())
  return typeof value === 'string' ? value.trim() : ''
}

export function validateUsername(value: string): string | null {
  const username = value.trim()
  if (!username) return '请输入用户名'
  if (username.length < USERNAME_MIN_LENGTH) return `用户名至少需要 ${USERNAME_MIN_LENGTH} 个字符`
  if (username.length > USERNAME_MAX_LENGTH) return `用户名不能超过 ${USERNAME_MAX_LENGTH} 个字符`
  return null
}
