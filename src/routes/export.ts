import { FileManager } from '../lib/file-manager'
import { generateCode } from '../services/ai/code-generator'
import { runPipeline } from '../services/pipeline/orchestrator'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { prompt, options } = body
    const { workspace: workspacePath, workspaceName, versionId: targetVersionId } = options || {}

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

    let fileManager: FileManager | null = null
    let generationResult: Awaited<ReturnType<typeof generateCode>>

    if (workspacePath) {
      fileManager = new FileManager(workspacePath)
      const exists = await fileManager.exists()

      if (!exists) {
        await fileManager.init({ path: workspacePath, name: workspaceName })
      }

      generationResult = await generateCode(prompt, {
        workspacePath,
      })
    } else {
      generationResult = await generateCode(prompt)
    }

    const result = await runPipeline(prompt, options || {})

    if (!result.success || !result.data) {
      return Response.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 },
      )
    }

    let versionId: string | undefined
    let workspaceMeta: Awaited<ReturnType<FileManager['getMeta']>> | undefined

    if (fileManager) {
      const artifacts = result.data.artifacts
        ? {
            pcbSvg: result.data.artifacts.pcbSvg || undefined,
            schematicSvg: result.data.artifacts.schematicSvg || undefined,
          }
        : undefined

      versionId = await fileManager.saveGeneratedResult({
        path: workspacePath,
        code: generationResult.code,
        prompt,
        kicadFiles: result.data.kicadFiles,
        isValid: true,
        versionId: targetVersionId,
        artifacts,
      })

      workspaceMeta = await fileManager.getMeta()
    }

    return Response.json({
      success: true,
      versionId,
      workspace: workspaceMeta
        ? {
            path: workspacePath,
            name: workspaceMeta.name,
            currentVersion: workspaceMeta.currentVersion,
            versions: workspaceMeta.versions,
          }
        : undefined,
      data: {
        circuitJson: result.data.circuitJson,
        kicadFiles: result.data.kicadFiles,
        validation: result.data.validation,
        artifacts: result.data.artifacts,
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
