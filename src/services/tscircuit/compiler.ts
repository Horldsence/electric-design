import { runTscircuitCode } from '@tscircuit/eval'
import { createPipelineLogger } from '../../lib/debug'
import type { CompilationResult } from '../../types/tscircuit'
import { extractErrors } from './error-extractor'

export class CompilerService {
  private activeSessionId: string | null = null
  private activeAbort: AbortController | null = null
  private mutex: Promise<void> = Promise.resolve()

  async compile(sessionId: string, code: string): Promise<CompilationResult> {
    const log = createPipelineLogger('tscircuit-compile', sessionId)

    // Cancel any in-flight compilation — only one compilation at a time.
    if (this.activeAbort) {
      const staleId = this.activeSessionId
      log.info('Cancelling stale compilation', { staleSessionId: staleId })
      this.activeAbort.abort()
      this.activeAbort = null
      this.activeSessionId = null
    }

    const abort = new AbortController()
    this.activeAbort = abort
    this.activeSessionId = sessionId

    // Serialize through a mutex so a cancelled compilation's promise
    // settles before the next one starts executing runTscircuitCode.
    const ticket = this.mutex
    let release: () => void
    this.mutex = new Promise<void>((resolve) => {
      release = resolve
    })

    try {
      log.info('Waiting for mutex', { sessionId })
      await ticket
      log.info('Mutex acquired', { sessionId })

      if (abort.signal.aborted) {
        log.warn('Aborted before execution started', { sessionId })
        return { circuitJson: [], logs: [], errors: [{ type: 'abort', messageType: 'abort', message: 'Compilation cancelled', details: {} }] }
      }

      log.info('Starting compilation', { codeLength: code.length })

      const circuitJson = await runTscircuitCode(code)

      if (abort.signal.aborted) {
        log.warn('Aborted after execution completed', { sessionId })
        return { circuitJson: [], logs: [], errors: [{ type: 'abort', messageType: 'abort', message: 'Compilation cancelled', details: {} }] }
      }

      log.debug('Code executed successfully')
      log.info('Compilation successful', { elementCount: circuitJson.length })

      return { circuitJson, logs: [] }
    } catch (error) {
      if (abort.signal.aborted) {
        log.warn('Caught error after abort — discarding', { sessionId })
        return { circuitJson: [], logs: [], errors: [{ type: 'abort', messageType: 'abort', message: 'Compilation cancelled', details: {} }] }
      }

      const errors = extractErrors(error, code)

      log.error('Compilation failed', error)
      log.warn('Error details', {
        errorCount: errors.length,
        errorTypes: errors.map(e => e.type),
        errorLocations: errors.map(e => e.location?.line ?? 'unknown'),
      })

      return {
        circuitJson: [],
        logs: [],
        errors,
        sourceCode: code,
      }
    } finally {
      // Only clear active state if we are still the active compilation.
      if (this.activeSessionId === sessionId) {
        this.activeAbort = null
        this.activeSessionId = null
        log.debug('Cleared active compilation state', { sessionId })
      }
      release!()
      log.debug('Mutex released', { sessionId })
    }
  }

  cleanup(_sessionId: string) {}
}

export const compilerService = new CompilerService()