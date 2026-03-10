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
    const { path, code, prompt, kicadFiles, timestamp, isValid = true, versionId } = body

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
      await fileManager.init({ path })
    }

    const savedVersionId = await fileManager.saveGeneratedResult({
      path,
      code,
      prompt,
      timestamp,
      isValid,
      kicadFiles,
      versionId,
    })

    const meta = await fileManager.getMeta()

    return Response.json({
      success: true,
      versionId: savedVersionId,
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
    const versionId = url.searchParams.get('versionId')

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

    if (versionId) {
      const code = await fileManager.readVersionCode(versionId)
      if (code === null) {
        return Response.json(
          {
            success: false,
            error: {
              type: 'version_not_found',
              message: `Version ${versionId} not found`,
            },
          },
          { status: 404 },
        )
      }

      return Response.json({
        success: true,
        data: { code, versionId },
      })
    }

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

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { path, versionId, code, isValid, action } = body

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

    if (action === 'checkout') {
      if (!versionId || typeof versionId !== 'string') {
        return Response.json(
          {
            success: false,
            error: {
              type: 'invalid_request',
              message: 'versionId is required for checkout action',
            },
          },
          { status: 400 },
        )
      }

      await fileManager.checkoutVersion(versionId)
      const meta = await fileManager.getMeta()

      return Response.json({
        success: true,
        data: { versionId, meta },
      })
    }

    if (action === 'update-code') {
      if (!versionId || typeof versionId !== 'string') {
        return Response.json(
          {
            success: false,
            error: {
              type: 'invalid_request',
              message: 'versionId is required for update-code action',
            },
          },
          { status: 400 },
        )
      }

      if (code === undefined || typeof code !== 'string') {
        return Response.json(
          {
            success: false,
            error: {
              type: 'invalid_request',
              message: 'code is required for update-code action',
            },
          },
          { status: 400 },
        )
      }

      if (isValid === undefined || typeof isValid !== 'boolean') {
        return Response.json(
          {
            success: false,
            error: {
              type: 'invalid_request',
              message: 'isValid is required for update-code action',
            },
          },
          { status: 400 },
        )
      }

      await fileManager.updateVersionCode(versionId, code, isValid)
      const meta = await fileManager.getMeta()

      return Response.json({
        success: true,
        data: { versionId, meta },
      })
    }

    return Response.json(
      {
        success: false,
        error: {
          type: 'invalid_request',
          message: 'Invalid action. Supported actions: checkout, update-code',
        },
      },
      { status: 400 },
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

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const path = url.searchParams.get('path')
    const versionId = url.searchParams.get('versionId')

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

    if (!versionId) {
      return Response.json(
        {
          success: false,
          error: {
            type: 'invalid_request',
            message: 'versionId query parameter is required',
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

    await fileManager.deleteVersion(versionId)
    const meta = await fileManager.getMeta()

    return Response.json({
      success: true,
      data: { meta },
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
