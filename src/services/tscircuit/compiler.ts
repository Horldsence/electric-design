import { runTscircuitCode } from '@tscircuit/eval'
import { createPipelineLogger } from '../../lib/debug'
import type { CompilationResult } from '../../types/tscircuit'

export class CompilerService {
  async compile(sessionId: string, code: string): CompilationResult {
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
      log.error('Compilation failed', error)
      return {
        circuitJson: [],
        logs: [],
        errors: [
          {
            type: 'compilation_error',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      }
    }
  }

  cleanup(_sessionId: string) {}
}

export const compilerService = new CompilerService()
