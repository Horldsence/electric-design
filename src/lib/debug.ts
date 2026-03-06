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
      logger.debug(context, message, { ...base, ...data })
    },

    info(message: string, data?: unknown) {
      const context = base.stage ? `${base.pipeline}:${base.stage}` : base.pipeline || 'system'
      logger.info(context, message, { ...base, ...data })
    },

    warn(message: string, data?: unknown) {
      const context = base.stage ? `${base.pipeline}:${base.stage}` : base.pipeline || 'system'
      logger.warn(context, message, { ...base, ...data })
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
      )
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
