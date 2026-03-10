import { circuitJsonToPcbSvg, circuitJsonToSchematicSvg } from '../lib/circuit-to-svg-wrapper'
import { createPipelineLogger } from '../lib/debug'
import { createProgressEmitter } from '../lib/pipeline-progress'
import { convertToKiCad } from '../services/kicad/converter'
import { compilerService } from '../services/tscircuit/compiler'
import { validateCircuit } from '../services/tscircuit/validator'

export async function POST(req: Request) {
  const body = await req.json()
  const { code } = body

  // Allow the client to pass its own sessionId so it can correlate
  // progress events pushed over WebSocket.  Fall back to a server-
  // generated id for backward compatibility.
  const sessionId: string = body.sessionId || `compile_${Date.now()}`

  const log = createPipelineLogger('compile-and-convert', sessionId)
  const progress = createProgressEmitter(sessionId)

  log.info('Request received', { sessionId, hasCode: typeof code === 'string', codeLength: typeof code === 'string' ? code.length : 0 })

  try {
    if (!code || typeof code !== 'string') {
      progress.failed('Code is required')
      return Response.json(
        {
          success: false,
          error: {
            type: 'invalid_request',
            message: 'Code is required and must be a string',
          },
        },
        { status: 400 },
      )
    }

    // ── Stage 1: Compile ────────────────────────────────────────────
    progress.stage('compiling')
    log.info('Stage 1: compile — starting', { sessionId, codeLength: code.length })

    const compileResult = await compilerService.compile(sessionId, code)

    log.info('Stage 1: compile — finished', {
      sessionId,
      hasErrors: !!(compileResult.errors && compileResult.errors.length > 0),
      errorCount: compileResult.errors?.length ?? 0,
      elementCount: compileResult.circuitJson?.length ?? 0,
    })

    if (compileResult.errors && compileResult.errors.length > 0) {
      const isAbort = compileResult.errors.some(e => e.type === 'abort')
      compilerService.cleanup(sessionId)
      log.error('Compilation failed', { sessionId, errorCount: compileResult.errors.length, isAbort })
      progress.failed(isAbort ? 'Compilation cancelled' : 'Compilation failed')
      return Response.json(
        {
          success: false,
          sessionId,
          error: {
            type: 'compilation_failed',
            message: 'Failed to compile tscircuit code',
            details: {
              errors: compileResult.errors,
              logs: compileResult.logs,
            },
          },
        },
        { status: 400 },
      )
    }

    log.info('Compilation successful', { sessionId, elementCount: compileResult.circuitJson?.length || 0 })

    // ── Stage 2: Validate ───────────────────────────────────────────
    progress.stage('validating')
    log.info('Stage 2: validate — starting', { sessionId })

    let validation: Awaited<ReturnType<typeof validateCircuit>>
    try {
      validation = await validateCircuit(compileResult.circuitJson)
      log.info('Stage 2: validate — finished', {
        sessionId,
        isValid: validation.isValid,
        errorCount: validation.errors.length,
      })
    } catch (error) {
      log.error('Stage 2: validate — threw error', { sessionId, error })
      validation = { isValid: false, errors: [] }
    }

    if (!validation.isValid) {
      compilerService.cleanup(sessionId)
      log.error('Stage 2: validate — failed', { sessionId, errorCount: validation.errors.length })
      progress.failed('Validation failed')
      return Response.json(
        {
          success: false,
          sessionId,
          error: {
            type: 'validation_failed',
            message: 'Circuit validation failed',
            details: {
              errors: validation.errors,
            },
          },
        },
        { status: 400 },
      )
    }

    log.info('Stage 2: validate — passed', { sessionId })

    // ── Stage 3: KiCad conversion ───────────────────────────────────
    progress.stage('converting')
    log.info('Stage 3: convert — starting', { sessionId })

    const kicadFiles = convertToKiCad(compileResult.circuitJson)

    log.info('Stage 3: convert — finished', { sessionId })
    compilerService.cleanup(sessionId)

    // ── Stage 4: SVG rendering ──────────────────────────────────────
    progress.stage('rendering')
    log.info('Stage 4: render — starting', { sessionId })

    let pcbSvg: string
    let schematicSvg: string | null = null

    try {
      pcbSvg = circuitJsonToPcbSvg(compileResult.circuitJson as any)
      log.info('Stage 4: render — PCB SVG generated', { sessionId })
      try {
        schematicSvg = circuitJsonToSchematicSvg(compileResult.circuitJson as any)
        log.info('Stage 4: render — Schematic SVG generated', { sessionId })
      } catch {
        schematicSvg = null
        log.warn('Stage 4: render — Schematic SVG generation failed (non-fatal)', { sessionId })
      }
    } catch (error) {
      log.error('Stage 4: render — SVG generation failed', { sessionId, error })
      progress.failed('SVG generation failed')
      return Response.json(
        {
          success: false,
          sessionId,
          error: {
            type: 'svg_generation_failed',
            message: 'Failed to generate SVG preview',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        { status: 500 },
      )
    }

    // ── Done ────────────────────────────────────────────────────────
    progress.completed()
    log.info('Pipeline complete — sending HTTP response', { sessionId })

    return Response.json({
      success: true,
      sessionId,
      data: {
        circuitJson: compileResult.circuitJson,
        kicadFiles: {
          pcb: kicadFiles.pcb,
          sch: kicadFiles.sch,
        },
        artifacts: {
          pcbSvg,
          schematicSvg: schematicSvg || undefined,
        },
        validation: {
          isValid: validation.isValid,
          errors: validation.errors,
        },
        logs: compileResult.logs,
      },
    })
  } catch (error) {
    log.error('Pipeline caught unexpected error', { sessionId, error: error instanceof Error ? error.message : error })
    progress.failed('Internal error')
    return Response.json(
      {
        success: false,
        sessionId,
        error: {
          type: 'server_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    )
  }
}