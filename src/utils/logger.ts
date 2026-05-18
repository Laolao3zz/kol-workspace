/**
 * 错误日志工具
 * 用于记录和追踪应用中的错误
 */

interface ErrorLog {
  context: string
  message: string
  stack?: string
  data?: any
  timestamp: string
  userAgent: string
}

class Logger {
  private logs: ErrorLog[] = []
  private maxLogs = 100

  logError(context: string, error: unknown, data?: any) {
    const log: ErrorLog = {
      context,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      data,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    }

    this.logs.push(log)

    // 保持最近的 N 条日志
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    // 开发环境打印详细信息
    if (import.meta.env.DEV) {
      console.group(`❌ [${context}] ${log.message}`)
      console.error('Error:', error)
      if (data) console.log('Data:', data)
      if (log.stack) console.log('Stack:', log.stack)
      console.groupEnd()
    } else {
      // 生产环境简化输出
      console.error(`[${context}]`, log.message)
    }

    // 可以在这里添加发送到监控服务的逻辑
    // this.sendToMonitoring(log)
  }

  logWarning(context: string, message: string, data?: any) {
    console.warn(`⚠️ [${context}]`, message, data)
  }

  logInfo(context: string, message: string, data?: any) {
    if (import.meta.env.DEV) {
      console.log(`ℹ️ [${context}]`, message, data)
    }
  }

  getLogs() {
    return [...this.logs]
  }

  clearLogs() {
    this.logs = []
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2)
  }
}

export const logger = new Logger()

// 便捷导出
export const logError = logger.logError.bind(logger)
export const logWarning = logger.logWarning.bind(logger)
export const logInfo = logger.logInfo.bind(logger)
