import { convertToKiCad } from '../services/kicad/converter'
import { validateCircuit } from '../services/tscircuit/validator'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { circuitJson } = body

    if (!Array.isArray(circuitJson)) {
      return Response.json(
        {
          success: false,
          error: {
            type: 'invalid_request',
            message: 'circuitJson must be an array',
          },
        },
        { status: 400 },
      )
    }

    const validation = await validateCircuit(circuitJson)

    if (!validation.isValid) {
      return Response.json(
        {
          success: false,
          error: {
            type: 'validation_failed',
            message: 'Circuit JSON validation failed',
            details: validation.errors,
          },
        },
        { status: 400 },
      )
    }

    const kicadFiles = convertToKiCad(circuitJson)

    return Response.json({
      success: true,
      data: kicadFiles,
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          type: 'conversion_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    )
  }
}
