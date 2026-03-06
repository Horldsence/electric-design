import { convertToKiCad } from '../services/kicad/converter'
import { compilerService } from '../services/tscircuit/compiler'
import { validateCircuit } from '../services/tscircuit/validator'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
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

    const sessionId = `compile_${Date.now()}`

    const compileResult = await compilerService.compile(sessionId, code)

    if (compileResult.errors && compileResult.errors.length > 0) {
      compilerService.cleanup(sessionId)
      return Response.json(
        {
          success: false,
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

    const validation = await validateCircuit(compileResult.circuitJson)

    if (!validation.isValid) {
      compilerService.cleanup(sessionId)
      return Response.json(
        {
          success: false,
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

    const kicadFiles = convertToKiCad(compileResult.circuitJson)

    compilerService.cleanup(sessionId)

    return Response.json({
      success: true,
      data: {
        circuitJson: compileResult.circuitJson,
        kicadFiles: {
          pcb: kicadFiles.pcb,
          sch: kicadFiles.sch,
        },
        validation: {
          isValid: validation.isValid,
          errors: validation.errors,
        },
        logs: compileResult.logs,
      },
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          type: 'server_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    )
  }
}
