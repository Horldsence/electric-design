type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogEntry = {
  level: LogLevel
  timestamp: number
  context: string
  message: string
  data?: unknown
  error?: {
    name: string
    message: string
    stack?: string
  }
  duration?: number
  [key: string]: unknown
}

class Logger {
  private minLevel: LogLevel
  private isProduction: boolean

  constructor(minLevel: LogLevel = 'info', isProduction = false) {
    this.minLevel = minLevel
    this.isProduction = isProduction
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    }
    return levels[level] >= levels[this.minLevel]
  }

  private format(entry: LogEntry): string {
    if (this.isProduction) {
      return JSON.stringify({
        level: entry.level,
        time: entry.timestamp,
        ctx: entry.context,
        msg: entry.message,
        ...(entry.data && { data: entry.data }),
        ...(entry.error && { err: entry.error }),
      })
    }

    const colors = {
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m',
    }

    const color = colors[entry.level]
    const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
    const errStr = entry.error ? ` [${entry.error.name}: ${entry.error.message}]` : ''
    const durationStr = entry.duration ? ` (${entry.duration}ms)` : ''

    return (
      `${color}[${entry.level.toUpperCase()}]${colors.reset} ` +
      `${entry.context} | ${entry.message}${dataStr}${errStr}${durationStr}`
    )
  }

  private log(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) {
      return
    }

    const formatted = this.format(entry)

    switch (entry.level) {
      case 'debug':
      case 'info':
        console.log(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }
  }

  debug(context: string, message: string, data?: unknown) {
    this.log({
      level: 'debug',
      timestamp: Date.now(),
      context,
      message,
      data,
    })
  }

  info(context: string, message: string, data?: unknown) {
    this.log({
      level: 'info',
      timestamp: Date.now(),
      context,
      message,
      data,
    })
  }

  warn(context: string, message: string, data?: unknown) {
    this.log({
      level: 'warn',
      timestamp: Date.now(),
      context,
      message,
      data,
    })
  }

  error(context: string, message: string, error?: Error | unknown) {
    const err =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined

    this.log({
      level: 'error',
      timestamp: Date.now(),
      context,
      message,
      error: err,
    })
  }

  measure(context: string, operation: string, fn: () => Promise<unknown> | unknown) {
    const start = Date.now()

    this.debug(context, `Starting: ${operation}`)

    const result = fn()

    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = Date.now() - start
        this.debug(context, `Finished: ${operation}`, { duration })
      })
    }

    const duration = Date.now() - start
    this.debug(context, `Finished: ${operation}`, { duration })
    return result
  }
}

import { getLogLevel, isProduction } from './config'

const logLevel = getLogLevel()
export const logger = new Logger(logLevel, isProduction())
