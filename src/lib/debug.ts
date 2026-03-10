import { logger } from './logger'

type DebugContext = {
  pipeline?: string
  sessionId?: string
  stage?: string
  [key: string]: unknown
}

export function debugContext(base: DebugContext) {
  return {
    debug(message: string, data?: unknown) {
      const context = base.stage ? `${base.pipeline}:${base.stage}` : base.pipeline || 'system'
      logger.debug(
        context,
        message,
        typeof data === 'object' && data !== null ? { ...base, ...data } : base,
      )
    },

    info(message: string, data?: unknown) {
      const context = base.stage ? `${base.pipeline}:${base.stage}` : base.pipeline || 'system'
      logger.info(
        context,
        message,
        typeof data === 'object' && data !== null ? { ...base, ...data } : base,
      )
    },

    warn(message: string, data?: unknown) {
      const context = base.stage ? `${base.pipeline}:${base.stage}` : base.pipeline || 'system'
      logger.warn(
        context,
        message,
        typeof data === 'object' && data !== null ? { ...base, ...data } : base,
      )
    },

    error(message: string, error?: Error | unknown) {
      const context = base.stage ? `${base.pipeline}:${base.stage}` : base.pipeline || 'system'
      logger.error(context, message, error)
    },

    measure<T>(operation: string, fn: () => Promise<T> | T): Promise<T> | T {
      return logger.measure(
        base.stage ? `${base.pipeline}:${base.stage}` : base.pipeline || 'system',
        operation,
        fn,
      ) as Promise<T> | T
    },
  }
}

export function createPipelineLogger(pipeline: string, sessionId: string) {
  return {
    stage(stageName: string) {
      return debugContext({
        pipeline,
        sessionId,
        stage: stageName,
      })
    },

    debug(message: string, data?: unknown) {
      logger.debug(`${pipeline}:${sessionId}`, message, data)
    },

    info(message: string, data?: unknown) {
      logger.info(`${pipeline}:${sessionId}`, message, data)
    },

    warn(message: string, data?: unknown) {
      logger.warn(`${pipeline}:${sessionId}`, message, data)
    },

    error(message: string, error?: Error | unknown) {
      logger.error(`${pipeline}:${sessionId}`, message, error)
    },
  }
}
