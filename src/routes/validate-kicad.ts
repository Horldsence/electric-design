import type { Request } from 'bun'
import { createPipelineLogger } from '../lib/debug'
import {
  analyzeValidationErrors,
  autoFixValidationErrors,
  formatValidationErrors,
} from '../services/kicad/auto-fix'
import { convertToKiCad } from '../services/kicad/converter'
import {
  checkKiCadAvailability,
  generateBom,
  generateGerber,
  runDrc,
  runErc,
} from '../services/kicad/validator'
import { KiCadValidationError } from '../services/pipeline/error-handler'
import { compilerService } from '../services/tscircuit/compiler'

/**
 * POST /api/validate-kicad
 * Run ERC/DRC validation on KiCad files
 */
export async function validateKiCad(req: Request): Promise<Response> {
  const log = createPipelineLogger('validate-kicad-api', 'request')

  try {
    const body = await req.json()
    const { sch, pcb, runErc: doErc = true, runDrc: doDrc = true, autoFix = false } = body

    if (!sch && !pcb) {
      return Response.json({ error: 'Missing required fields: sch or pcb' }, { status: 400 })
    }

    log.info('Validation request', { hasErc: !!sch && doErc, hasDrc: !!pcb && doDrc, autoFix })

    const sessionId = `validate_${Date.now()}`
    const results: {
      success: boolean
      checks: Record<string, unknown>
    } = {
      success: true,
      checks: {},
    }

    // Check KiCad availability first
    const availability = await checkKiCadAvailability()
    if (!availability.available) {
      return Response.json(
        {
          error: 'KiCad CLI not available',
          message: 'Please install KiCad to use validation features',
        },
        { status: 503 },
      )
    }

    log.info('KiCad CLI available', { version: availability.version, path: availability.path })

    // Run ERC if schematic provided
    if (sch && doErc) {
      try {
        log.info('Running ERC')
        const ercResult = await runErc(sch, sessionId)
        results.checks.erc = {
          passed: true,
          errors: ercResult.errors,
          warnings: ercResult.warnings,
          exitCode: ercResult.exitCode,
        }
        log.info('✓ ERC passed', {
          errors: ercResult.errors.length,
          warnings: ercResult.warnings.length,
        })
      } catch (error) {
        if (error instanceof KiCadValidationError) {
          log.error('ERC failed', { violations: error.violations.length })

          const analysis = analyzeValidationErrors(error)
          results.checks.erc = {
            passed: false,
            violations: error.violations,
            analysis,
            formatted: formatValidationErrors(error),
          }

          if (!autoFix) {
            results.success = false
          }
        } else {
          throw error
        }
      }
    }

    // Run DRC if PCB provided
    if (pcb && doDrc) {
      try {
        log.info('Running DRC')
        const drcResult = await runDrc(pcb, sessionId)
        results.checks.drc = {
          passed: true,
          errors: drcResult.errors,
          warnings: drcResult.warnings,
          exitCode: drcResult.exitCode,
        }
        log.info('✓ DRC passed', {
          errors: drcResult.errors.length,
          warnings: drcResult.warnings.length,
        })
      } catch (error) {
        if (error instanceof KiCadValidationError) {
          log.error('DRC failed', { violations: error.violations.length })

          const analysis = analyzeValidationErrors(error)
          results.checks.drc = {
            passed: false,
            violations: error.violations,
            analysis,
            formatted: formatValidationErrors(error),
          }

          if (!autoFix) {
            results.success = false
          }
        } else {
          throw error
        }
      }
    }

    return Response.json(results)
  } catch (error) {
    log.error('Validation error', error)
    return Response.json(
      {
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

/**
 * POST /api/check-kicad
 * Check if KiCad CLI is available
 */
export async function checkKiCad(_req: Request): Promise<Response> {
  const log = createPipelineLogger('check-kicad-api', 'request')

  try {
    log.info('Checking KiCad availability')
    const availability = await checkKiCadAvailability()

    return Response.json({
      available: availability.available,
      version: availability.version,
      path: availability.path,
    })
  } catch (error) {
    log.error('Check failed', error)
    return Response.json(
      {
        error: 'Failed to check KiCad availability',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

/**
 * POST /api/export-gerber
 * Generate Gerber files from PCB
 */
export async function exportGerber(req: Request): Promise<Response> {
  const log = createPipelineLogger('export-gerber-api', 'request')

  try {
    const body = await req.json()
    const { pcb } = body

    if (!pcb) {
      return Response.json({ error: 'Missing required field: pcb' }, { status: 400 })
    }

    log.info('Gerber export request')

    const sessionId = `gerber_${Date.now()}`
    const gerbers = await generateGerber(pcb, sessionId)

    const layerCount = Object.keys(gerbers).length
    log.info('✓ Gerbers generated', { layers: layerCount })

    return Response.json({
      success: true,
      layers: Object.keys(gerbers),
      gerbers,
    })
  } catch (error) {
    log.error('Gerber export failed', error)
    return Response.json(
      {
        error: 'Gerber export failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

/**
 * POST /api/export-bom
 * Generate BOM from schematic
 */
export async function exportBom(req: Request): Promise<Response> {
  const log = createPipelineLogger('export-bom-api', 'request')

  try {
    const body = await req.json()
    const { sch } = body

    if (!sch) {
      return Response.json({ error: 'Missing required field: sch' }, { status: 400 })
    }

    log.info('BOM export request')

    const sessionId = `bom_${Date.now()}`
    const bom = await generateBom(sch, sessionId)

    log.info('✓ BOM generated', { items: bom.length })

    return Response.json({
      success: true,
      itemCount: bom.length,
      bom,
    })
  } catch (error) {
    log.error('BOM export failed', error)
    return Response.json(
      {
        error: 'BOM export failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

/**
 * POST /api/auto-fix-validation
 * Attempt to automatically fix validation errors using AI
 */
export async function autoFixValidation(req: Request): Promise<Response> {
  const log = createPipelineLogger('auto-fix-api', 'request')

  try {
    const body = await req.json()
    const { originalPrompt, originalCode, checkType, violations, maxRetries = 3 } = body

    if (!originalPrompt || !originalCode || !checkType || !violations) {
      return Response.json(
        { error: 'Missing required fields: originalPrompt, originalCode, checkType, violations' },
        { status: 400 },
      )
    }

    log.info('Auto-fix request', { checkType, violations: violations.length, maxRetries })

    const sessionId = `autofix_${Date.now()}`

    // Create validation error from request
    const validationError = new KiCadValidationError(
      `${checkType.toUpperCase()}: ${violations.length} violation(s)`,
      checkType,
      violations,
    )

    // Compile and validate function
    const compileAndValidate = async (code: string) => {
      const compileSessionId = `${sessionId}_attempt_${Date.now()}`

      try {
        // Compile the code
        const { circuitJson, errors: compileErrors } = await compilerService.compile(
          compileSessionId,
          code,
        )

        if (compileErrors && compileErrors.length > 0) {
          compilerService.cleanup(compileSessionId)
          return { success: false }
        }

        // Convert to KiCad
        const kicadFiles = convertToKiCad(circuitJson)

        // Run appropriate validation
        try {
          if (checkType === 'erc') {
            const ercResult = await runErc(kicadFiles.sch, compileSessionId)
            compilerService.cleanup(compileSessionId)
            return { success: true, ercResult }
          }
          if (checkType === 'drc') {
            const drcResult = await runDrc(kicadFiles.pcb, compileSessionId)
            compilerService.cleanup(compileSessionId)
            return { success: true, drcResult }
          }
        } catch (error) {
          compilerService.cleanup(compileSessionId)
          if (error instanceof KiCadValidationError) {
            return {
              success: false,
              error,
              ercResult: checkType === 'erc' ? undefined : undefined,
              drcResult: checkType === 'drc' ? undefined : undefined,
            }
          }
          return { success: false }
        }

        compilerService.cleanup(compileSessionId)
        return { success: false }
      } catch (error) {
        compilerService.cleanup(compileSessionId)
        log.error('Compile and validate error', error)
        return { success: false }
      }
    }

    // Run auto-fix
    const result = await autoFixValidationErrors(
      originalPrompt,
      originalCode,
      validationError,
      compileAndValidate,
      { maxRetries },
      sessionId,
    )

    log.info('Auto-fix completed', {
      fixed: result.fixed,
      attempts: result.attempts,
      originalErrors: result.originalErrors,
      remainingErrors: result.remainingErrors,
    })

    return Response.json({
      success: result.fixed,
      result: {
        fixed: result.fixed,
        attempts: result.attempts,
        originalErrors: result.originalErrors,
        remainingErrors: result.remainingErrors,
        fixedCode: result.fixedCode,
        fixHistory: result.fixHistory,
      },
    })
  } catch (error) {
    log.error('Auto-fix failed', error)
    return Response.json(
      {
        error: 'Auto-fix failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
