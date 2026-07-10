import { describe, expect, it } from 'vitest'
import {
  getSupabaseTarget,
  requireMatchingProjectRef,
} from './product-alias-repair-config.mjs'

describe('product alias repair configuration', () => {
  it('extracts a sanitized Supabase target without exposing credentials', () => {
    expect(getSupabaseTarget('https://project-abc.supabase.co')).toEqual({
      host: 'project-abc.supabase.co',
      projectRef: 'project-abc',
    })
  })

  it('rejects non-HTTPS and non-Supabase maintenance targets', () => {
    expect(() => getSupabaseTarget('http://project-abc.supabase.co')).toThrow('must use HTTPS')
    expect(() => getSupabaseTarget('https://example.com')).toThrow('must use a supabase.co host')
  })

  it('requires an explicit matching project ref before apply', () => {
    expect(() => requireMatchingProjectRef({
      apply: false,
      expectedProjectRef: '',
      actualProjectRef: 'project-abc',
    })).not.toThrow()
    expect(() => requireMatchingProjectRef({
      apply: true,
      expectedProjectRef: 'project-abc',
      actualProjectRef: 'project-abc',
    })).not.toThrow()
    expect(() => requireMatchingProjectRef({
      apply: true,
      expectedProjectRef: 'other-project',
      actualProjectRef: 'project-abc',
    })).toThrow('Apply target mismatch')
    expect(() => requireMatchingProjectRef({
      apply: true,
      expectedProjectRef: '',
      actualProjectRef: 'project-abc',
    })).toThrow('requires --project-ref project-abc')
  })
})
