import { createPipelineLogger } from '../../lib/debug'
import { generateCode } from '../ai/code-generator'
import { convertToKiCad } from '../kicad/converter'
import { postProcess } from '../kicad/validator'
import { compilerService } from '../tscircuit/compiler'
import { validateCircuit } from '../tscircuit/validator'

type PipelineResult = {
  success: boolean
  data?: {
    circuitJson: unknown[]
    kicadFiles: { pcb: string; sch: string }
    validation: { isValid: boolean; errors: unknown[] }
    artifacts?: unknown
  }
  error?: {
    type: string
    message: string
    details?: unknown
  }
}

export async function runPipeline(
  userPrompt: string,
  options = { runErc: false, runDrc: false, generateGerber: false },
): Promise<PipelineResult> {
  const sessionId = `session_${Date.now()}`
  const log = createPipelineLogger('pipeline', sessionId)

  try {
    log.info('Pipeline started', { promptLength: userPrompt.length })

    const aiStage = log.stage('ai-generation')
    const generationResult = await aiStage.measure('generate-code', async () => {
      const result = await generateCode(userPrompt)
      aiStage.debug('Code generated', { codeLength: result.code.length })
      return result
    })

    const _compileStage = log.stage('compile')
    const {
      circuitJson,
      logs,
      errors: compileErrors,
    } = await compilerService.compile(sessionId, generationResult.code)

    if (compileErrors && compileErrors.length > 0) {
      compilerService.cleanup(sessionId)
      log.error('Compilation failed', { errors: compileErrors })
      return {
        success: false,
        error: {
          type: 'compilation_failed',
          message: 'Failed to compile tscircuit code',
          details: { logs, errors: compileErrors },
        },
      }
    }

    const validationStage = log.stage('validation')
    const validation = await validateCircuit(circuitJson)

    if (!validation.isValid) {
      compilerService.cleanup(sessionId)
      log.error('Validation failed', { errors: validation.errors })
      return {
        success: false,
        error: {
          type: 'validation_failed',
          message: 'Circuit validation failed',
          details: { errors: validation.errors },
        },
      }
    }

    validationStage.info('Validation passed', { errorCount: validation.errors.length })

    const convertStage = log.stage('convert')
    const kicadFiles = convertToKiCad(circuitJson)

    convertStage.info('Conversion complete', {
      pcbSize: kicadFiles.pcb.length,
      schSize: kicadFiles.sch.length,
    })

    compilerService.cleanup(sessionId)

    const artifacts = options ? await postProcess(kicadFiles, options) : undefined

    log.info('Pipeline completed successfully')

    return {
      success: true,
      data: {
        circuitJson,
        kicadFiles,
        validation,
        artifacts,
      },
    }
  } catch (error) {
    log.error('Pipeline error', error)
    return {
      success: false,
      error: {
        type: 'pipeline_error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error,
      },
    }
  }
}
