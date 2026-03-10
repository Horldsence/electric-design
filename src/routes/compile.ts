import type { AnyCircuitElement } from 'circuit-json'
import { circuitJsonToPcbSvg, circuitJsonToSchematicSvg } from '../lib/circuit-to-svg-wrapper'
import { createProgressEmitter } from '../lib/pipeline-progress'
import { compilerService } from '../services/tscircuit/compiler'
import { validateCircuit } from '../services/tscircuit/validator'

export async function POST(req: Request) {
  const body = await req.json()
  const { code } = body

  // Allow the client to pass its own sessionId so it can correlate
  // progress events pushed over WebSocket.  Fall back to a server-
  // generated id for backward compatibility.
  const sessionId: string = body.sessionId || `compile_${Date.now()}`

  const progress = createProgressEmitter(sessionId)

  try {
    if (!code || typeof code !== 'string') {
      progress.failed('Code is required')
      return Response.json(
        {
          success: false,
          sessionId,
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

    const result = await compilerService.compile(sessionId, code)

    if (result.errors && result.errors.length > 0) {
      compilerService.cleanup(sessionId)
      progress.failed('Compilation failed')
      return Response.json(
        {
          success: false,
          sessionId,
          error: {
            type: 'compilation_error',
            message: 'Compilation failed',
            details: { errors: result.errors, logs: result.logs },
          },
        },
        { status: 400 },
      )
    }

    compilerService.cleanup(sessionId)

    // ── Stage 2: Validate ───────────────────────────────────────────
    progress.stage('validating')

    const validation = validateCircuit(result.circuitJson)
    const circuitJson = result.circuitJson as AnyCircuitElement[]

    // ── Stage 3: SVG rendering ──────────────────────────────────────
    progress.stage('rendering')

    let pcbSvg: string | null = null
    let schematicSvg: string | null = null

    try {
      pcbSvg = circuitJsonToPcbSvg(circuitJson)
    } catch {
      // PCB SVG generation failed — non-fatal
    }

    try {
      schematicSvg = circuitJsonToSchematicSvg(circuitJson)
    } catch {
      // Schematic SVG generation failed — non-fatal
    }

    // ── Done ────────────────────────────────────────────────────────
    progress.completed()

    return Response.json({
      success: true,
      sessionId,
      data: {
        circuitJson: result.circuitJson,
        logs: result.logs,
        validation,
        svg: pcbSvg, // backward compatibility
        pcbSvg,
        schematicSvg,
      },
    })
  } catch (error) {
    progress.failed('Internal error')
    return Response.json(
      {
        success: false,
        sessionId,
        error: {
          type: 'compilation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    )
  }
}