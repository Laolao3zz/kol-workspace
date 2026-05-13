import { useState, useCallback } from 'react'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useAsync<T>() {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const run = useCallback(async (fn: () => Promise<T>) => {
    setState({ data: null, loading: true, error: null })
    try {
      const data = await fn()
      setState({ data, loading: false, error: null })
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败'
      setState({ data: null, loading: false, error: message })
      throw err
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return { ...state, run, clearError }
}
