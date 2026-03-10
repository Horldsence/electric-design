import type { AnyCircuitElement } from 'circuit-json'
// @ts-ignore
import { svgCache } from '../services/cache/svg-cache'
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
    const result = await compilerService.compile(sessionId, code)

    compilerService.cleanup(sessionId)

    const validation = validateCircuit(result.circuitJson)
    const circuitJson = result.circuitJson as AnyCircuitElement[]
    const { pcbSvg, schematicSvg } = svgCache.getSvgs(code, circuitJson)

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
