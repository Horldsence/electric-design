import { runTscircuitCode } from '@tscircuit/eval'
import { createPipelineLogger } from '../../lib/debug'
import type { CompilationResult } from '../../types/tscircuit'
import { extractErrors } from './error-extractor'

export class CompilerService {
  async compile(sessionId: string, code: string): Promise<CompilationResult> {
    const log = createPipelineLogger('tscircuit-compile', sessionId)

    try {
      log.info('Starting compilation', { codeLength: code.length })

      const circuitJson = await runTscircuitCode(code)
      log.debug('Code executed successfully')

      log.info('Compilation successful', {
        elementCount: circuitJson.length,
      })

      return { circuitJson, logs: [] }
    } catch (error) {
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
    }
  }

  cleanup(_sessionId: string) {}
}

export const compilerService = new CompilerService()
