import { FileManager } from '../lib/file-manager'
import type { InitWorkspaceOptions, SaveWorkspaceResultRequest } from '../types/workspace'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { path, name } = body as InitWorkspaceOptions

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

    const fileManager = new FileManager(path)
    const exists = await fileManager.exists()

    if (exists) {
      const meta = await fileManager.getMeta()
      return Response.json({
        success: true,
        data: meta,
      })
    }

    const meta = await fileManager.init({ path, name })

    return Response.json({
      success: true,
      data: meta,
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

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as SaveWorkspaceResultRequest
    const { path, code, prompt, kicadFiles, timestamp, isValid = true } = body

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

    if (
      !kicadFiles ||
      typeof kicadFiles !== 'object' ||
      typeof kicadFiles.pcb !== 'string' ||
      typeof kicadFiles.sch !== 'string'
    ) {
      return Response.json(
        {
          success: false,
          error: {
            type: 'invalid_request',
            message: 'kicadFiles with pcb and sch content is required',
          },
        },
        { status: 400 },
      )
    }

    const fileManager = new FileManager(path)
    const exists = await fileManager.exists()

    if (!exists) {
      return Response.json(
        {
          success: false,
          error: {
            type: 'workspace_not_found',
            message: 'Workspace not found',
          },
        },
        { status: 404 },
      )
    }

    const versionId = await fileManager.saveGeneratedResult({
      path,
      code,
      prompt,
      timestamp,
      isValid,
      kicadFiles,
    })

    const meta = await fileManager.getMeta()

    return Response.json({
      success: true,
      versionId,
      data: meta,
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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const path = url.searchParams.get('path')

    if (!path) {
      return Response.json(
        {
          success: false,
          error: {
            type: 'invalid_request',
            message: 'Path query parameter is required',
          },
        },
        { status: 400 },
      )
    }

    const fileManager = new FileManager(path)
    const meta = await fileManager.getMeta()

    if (!meta) {
      return Response.json(
        {
          success: false,
          error: {
            type: 'workspace_not_found',
            message: 'Workspace not found',
          },
        },
        { status: 404 },
      )
    }

    return Response.json({
      success: true,
      data: meta,
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
