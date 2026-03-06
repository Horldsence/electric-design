import { createPipelineLogger } from '../../lib/debug'
import type { DrcResult, ErcResult } from '../../types/kicad'
import { generateCode } from '../ai/code-generator'
import { autoFixValidationErrors, formatValidationErrors } from '../kicad/auto-fix'
import { convertToKiCad } from '../kicad/converter'
import { postProcess, runDrc, runErc } from '../kicad/validator'
import { compilerService } from '../tscircuit/compiler'
import { validateCircuit } from '../tscircuit/validator'
import { KiCadValidationError } from './error-handler'

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
  options = {
    runErc: false,
    runDrc: false,
    generateGerber: false,
    autoFix: false,
    maxAutoFixRetries: 3,
  },
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
    let kicadFiles = convertToKiCad(circuitJson)

    convertStage.info('Conversion complete', {
      pcbSize: kicadFiles.pcb.length,
      schSize: kicadFiles.sch.length,
    })

    compilerService.cleanup(sessionId)

    // Run KiCad validation checks if requested
    let ercResult: ErcResult | undefined
    let drcResult: DrcResult | undefined
    let autoFixAttempted = false
    let autoFixResult:
      | {
          fixed: boolean
          attempts: number
          originalErrors: number
          remainingErrors: number
          fixedCode?: string
          fixHistory: Array<{
            attempt: number
            strategy: string
            errorsFound: number
            errorTypes: string[]
          }>
        }
      | undefined = undefined

    try {
      if (options.runErc) {
        const ercStage = log.stage('erc-check')
        ercStage.info('Running ERC')
        try {
          ercResult = await runErc(kicadFiles.sch, sessionId)
          ercStage.info('✓ ERC passed', {
            errors: ercResult.errors.length,
            warnings: ercResult.warnings.length,
          })
        } catch (error) {
          if (error instanceof KiCadValidationError) {
            ercStage.error('ERC failed', { violations: error.violations.length })

            if (options.autoFix) {
              ercStage.info('Attempting auto-fix')
              autoFixAttempted = true

              autoFixResult = await autoFixValidationErrors(
                userPrompt,
                generationResult.code,
                error,
                async (code: string) => {
                  // Compile and validate the fixed code
                  const { circuitJson: newCircuitJson, errors: newCompileErrors } =
                    await compilerService.compile(`${sessionId}_fix`, code)

                  if (newCompileErrors && newCompileErrors.length > 0) {
                    compilerService.cleanup(`${sessionId}_fix`)
                    return { success: false }
                  }

                  const newKicadFiles = convertToKiCad(newCircuitJson)

                  try {
                    const newErcResult = await runErc(newKicadFiles.sch, `${sessionId}_fix`)
                    compilerService.cleanup(`${sessionId}_fix`)
                    return { success: true, ercResult: newErcResult }
                  } catch (fixError) {
                    compilerService.cleanup(`${sessionId}_fix`)
                    if (fixError instanceof KiCadValidationError) {
                      return { success: false, error: fixError, ercResult: undefined }
                    }
                    return { success: false }
                  }
                },
                { maxRetries: options.maxAutoFixRetries || 3 },
                sessionId,
              )

              if (autoFixResult.fixed) {
                ercStage.info('✓ Auto-fix successful', { attempts: autoFixResult.attempts })
                // Regenerate circuit with fixed code
                const { circuitJson: fixedCircuitJson } = await compilerService.compile(
                  `${sessionId}_final`,
                  autoFixResult.fixedCode || '',
                )
                kicadFiles = convertToKiCad(fixedCircuitJson)
                compilerService.cleanup(`${sessionId}_final`)
              } else {
                ercStage.warn('Auto-fix incomplete', {
                  attempts: autoFixResult.attempts,
                  remainingErrors: autoFixResult.remainingErrors,
                })
              }
            }

            if (!options.autoFix || !autoFixResult?.fixed) {
              // Still throw if not fixed
              log.error(formatValidationErrors(error))
              throw error
            }
          } else {
            throw error
          }
        }
      }

      if (options.runDrc) {
        const drcStage = log.stage('drc-check')
        drcStage.info('Running DRC')
        try {
          drcResult = await runDrc(kicadFiles.pcb, sessionId)
          drcStage.info('✓ DRC passed', {
            errors: drcResult.errors.length,
            warnings: drcResult.warnings.length,
          })
        } catch (error) {
          if (error instanceof KiCadValidationError) {
            drcStage.error('DRC failed', { violations: error.violations.length })

            if (options.autoFix && !autoFixAttempted) {
              drcStage.info('Attempting auto-fix')
              autoFixAttempted = true

              autoFixResult = await autoFixValidationErrors(
                userPrompt,
                generationResult.code,
                error,
                async (code: string) => {
                  const { circuitJson: newCircuitJson, errors: newCompileErrors } =
                    await compilerService.compile(`${sessionId}_fix`, code)

                  if (newCompileErrors && newCompileErrors.length > 0) {
                    compilerService.cleanup(`${sessionId}_fix`)
                    return { success: false }
                  }

                  const newKicadFiles = convertToKiCad(newCircuitJson)

                  try {
                    const newDrcResult = await runDrc(newKicadFiles.pcb, `${sessionId}_fix`)
                    compilerService.cleanup(`${sessionId}_fix`)
                    return { success: true, drcResult: newDrcResult }
                  } catch (fixError) {
                    compilerService.cleanup(`${sessionId}_fix`)
                    if (fixError instanceof KiCadValidationError) {
                      return { success: false, error: fixError, drcResult: undefined }
                    }
                    return { success: false }
                  }
                },
                { maxRetries: options.maxAutoFixRetries || 3 },
                sessionId,
              )

              if (autoFixResult.fixed) {
                drcStage.info('✓ Auto-fix successful', { attempts: autoFixResult.attempts })
                const { circuitJson: fixedCircuitJson } = await compilerService.compile(
                  `${sessionId}_final`,
                  autoFixResult.fixedCode || '',
                )
                kicadFiles = convertToKiCad(fixedCircuitJson)
                compilerService.cleanup(`${sessionId}_final`)
              } else {
                drcStage.warn('Auto-fix incomplete', {
                  attempts: autoFixResult.attempts,
                  remainingErrors: autoFixResult.remainingErrors,
                })
              }
            }

            if (!options.autoFix || !autoFixResult?.fixed) {
              log.error(formatValidationErrors(error))
              throw error
            }
          } else {
            throw error
          }
        }
      }
    } catch (error) {
      if (error instanceof KiCadValidationError) {
        return {
          success: false,
          error: {
            type: 'kicad_validation_failed',
            message: error.message,
            details: {
              checkType: error.checkType,
              violations: error.violations,
              autoFixAttempted,
              autoFixResult,
            },
          },
        }
      }
      throw error
    }

    const artifacts = options
      ? await postProcess(
          kicadFiles,
          {
            ...options,
            runErc: false, // Already done above
            runDrc: false, // Already done above
          },
          sessionId,
        )
      : undefined

    log.info('Pipeline completed successfully')

    return {
      success: true,
      data: {
        circuitJson,
        kicadFiles,
        validation,
        artifacts,
        ercResult,
        drcResult,
        autoFixResult,
      },
    }
  } catch (error) {
    log.error('Pipeline error', error)

    if (error instanceof KiCadValidationError) {
      return {
        success: false,
        error: {
          type: 'kicad_validation_failed',
          message: error.message,
          details: {
            checkType: error.checkType,
            violations: error.violations,
          },
        },
      }
    }

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
