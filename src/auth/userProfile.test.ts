import { describe, expect, it } from 'vitest'
import { readUsername, validateUsername } from './userProfile'

describe('user profile helpers', () => {
  it('reads and trims the canonical username metadata', () => {
    expect(readUsername({ username: '  老朱  ', full_name: '备用姓名' })).toBe('老朱')
  })

  it('supports display names from existing Supabase users', () => {
    expect(readUsername({ display_name: '运营同事' })).toBe('运营同事')
    expect(readUsername({ full_name: '内容负责人' })).toBe('内容负责人')
  })

  it('validates username length after trimming whitespace', () => {
    expect(validateUsername(' ')).toBe('请输入用户名')
    expect(validateUsername('A')).toBe('用户名至少需要 2 个字符')
    expect(validateUsername('A'.repeat(31))).toBe('用户名不能超过 30 个字符')
    expect(validateUsername('  老朱  ')).toBeNull()
  })
})
