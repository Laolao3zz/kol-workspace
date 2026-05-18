/**
 * 重试机制工具函数
 * 用于处理网络请求失败时的自动重试
 */

export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    delay?: number
    backoff?: boolean
    onRetry?: (attempt: number, error: unknown) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delay = 1000,
    backoff = true,
    onRetry
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt < maxRetries - 1) {
        const waitTime = backoff ? delay * Math.pow(2, attempt) : delay

        if (onRetry) {
          onRetry(attempt + 1, error)
        }

        console.warn(`操作失败，${waitTime}ms 后重试 (${attempt + 1}/${maxRetries})`, error)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  throw lastError
}

/**
 * 带超时的操作
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutError = '操作超时'
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    )
  ])
}
