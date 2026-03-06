import { compilerService } from '../services/tscircuit/compiler'
import { validateCircuit } from '../services/tscircuit/validator'
// @ts-ignore
import { convertCircuitJsonToPcbSvg, convertCircuitJsonToSchematicSvg } from 'circuit-to-svg'

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
    const result = await compilerService.compile(sessionId, code)

    compilerService.cleanup(sessionId)

    const validation = validateCircuit(result.circuitJson)
    const pcbSvg = convertCircuitJsonToPcbSvg(result.circuitJson as any)
    
    let schematicSvg = null
    try {
      schematicSvg = convertCircuitJsonToSchematicSvg(result.circuitJson as any)
    } catch (error) {
      console.warn('Failed to generate schematic SVG:', error)
    }

    return Response.json({
      success: true,
      data: {
        circuitJson: result.circuitJson,
        logs: result.logs,
        validation,
        svg: pcbSvg, // PCB SVG for backward compatibility
        pcbSvg,
        schematicSvg,
      },
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          type: 'compilation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    )
  }
}
