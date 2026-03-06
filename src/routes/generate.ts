import { generateCode } from '../services/ai/code-generator'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { prompt } = body

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

    const result = await generateCode(prompt)

    return Response.json({
      success: true,
      data: {
        code: result.code,
        retryCount: result.retryCount,
        fallback: result.fallback || false,
      },
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          type: 'generation_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 },
    )
  }
}
