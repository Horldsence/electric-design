import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { path } = body

    if (!path || typeof path !== 'string') {
      return Response.json(
        {
          success: false,
          error: {
            type: 'invalid_request',
            message: 'Path is required and must be a string',
          },
        },
        { status: 400 },
      )
    }

    const platform = process.platform

    let command: string

    if (platform === 'darwin') {
      command = `open "${path}"`
    } else if (platform === 'win32') {
      command = `explorer "${path}"`
    } else {
      command = `xdg-open "${path}"`
    }

    await execAsync(command)

    return Response.json({
      success: true,
      data: { message: 'Folder opened successfully' },
    })
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: {
          type: 'server_error',
          message: error instanceof Error ? error.message : 'Failed to open folder',
        },
      },
      { status: 500 },
    )
  }
}
