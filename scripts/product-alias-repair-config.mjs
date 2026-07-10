export function getSupabaseTarget(supabaseUrl) {
  let parsed
  try {
    parsed = new URL(supabaseUrl)
  } catch {
    throw new Error('VITE_SUPABASE_URL in .env.local is not a valid URL.')
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Supabase maintenance target must use HTTPS.')
  }
  if (!/^[a-z0-9-]+\.supabase\.co$/i.test(parsed.hostname)) {
    throw new Error('Supabase maintenance target must use a supabase.co host.')
  }

  const [projectRef] = parsed.hostname.split('.')
  if (!projectRef) throw new Error('Could not determine the Supabase project ref.')

  return {
    host: parsed.hostname,
    projectRef,
  }
}

export function requireMatchingProjectRef({ apply, expectedProjectRef, actualProjectRef }) {
  if (!apply) return
  if (!expectedProjectRef) {
    throw new Error(`Apply requires --project-ref ${actualProjectRef}.`)
  }
  if (expectedProjectRef !== actualProjectRef) {
    throw new Error(`Apply target mismatch: expected ${actualProjectRef}, received ${expectedProjectRef}.`)
  }
}
