import { runPipeline } from '../services/pipeline/orchestrator'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { prompt, options } = body

    if (!prompt || typeof prompt !== 'string') {
      return Response.json(
        {
          success: false,
          error: {
            type: 'invalid_request',
            message: 'Prompt is required and must be a string',
          },
        },
        { status: 400 },
      )
    }

    const result = await runPipeline(prompt, options || {})

    if (result.success && result.data) {
      return Response.json({
        success: true,
        versionId: result.versionId,
        data: {
          circuitJson: result.data.circuitJson,
          kicadFiles: result.data.kicadFiles,
          validation: result.data.validation,
          artifacts: result.data.artifacts,
          pcbSvg:
            result.data.artifacts &&
            typeof result.data.artifacts === 'object' &&
            'pcbSvg' in result.data.artifacts
              ? result.data.artifacts.pcbSvg
              : undefined,
          schematicSvg:
            result.data.artifacts &&
            typeof result.data.artifacts === 'object' &&
            'schematicSvg' in result.data.artifacts
              ? result.data.artifacts.schematicSvg
              : undefined,
        },
      })
    }

    return Response.json(
      {
        success: false,
        error: result.error,
      },
      { status: 500 },
    )
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
