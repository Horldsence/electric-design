import type { DrcResult, ErcResult, KiBotOutput, PostProcessOptions } from '../../types/kicad'

export async function postProcess(
  kicadFiles: { pcb: string; sch: string },
  options: PostProcessOptions,
): Promise<KiBotOutput> {
  const result: KiBotOutput = {}

  if (options.runErc) {
    result.erc = await runErc(kicadFiles.sch)
  }

  if (options.runDrc) {
    result.drc = await runDrc(kicadFiles.pcb)
  }

  if (options.generateGerber) {
    result.gerbers = await generateGerber(kicadFiles.pcb)
  }

  if (options.generateBom) {
    result.bom = await generateBom(kicadFiles.sch)
  }

  return result
}

async function runErc(sch: string): Promise<ErcResult> {
  const { exec } = require('node:child_process')
  const { promisify } = require('node:util')
  const execAsync = promisify(exec)

  const tmpFile = `/tmp/tmp_${Date.now()}.kicad_sch`
  require('node:fs').writeFileSync(tmpFile, sch)

  try {
    const { stdout } = await execAsync(
      `kicad-cli sch erc --output - --format json --exit-code-violations "${tmpFile}"`,
    )

    try {
      const parsed = JSON.parse(stdout)
      return {
        exitCode: 0,
        report: stdout,
        errors:
          parsed.violations?.map(
            (v: {
              type?: string
              description?: string
              message?: string
              lineNumber?: number
            }) => ({
              type: v.type || 'erc_error',
              message: v.description || v.message,
              location: {
                file: tmpFile,
                line: v.lineNumber,
              },
            }),
          ) || [],
        warnings: [],
      }
    } catch {
      return {
        exitCode: 0,
        report: stdout,
        errors: [],
        warnings: [],
      }
    }
  } catch (error: unknown) {
    const err = error as { exitCode?: number; message?: string }
    return {
      exitCode: err.exitCode || 1,
      report: err.message || 'Unknown error',
      errors: [
        {
          type: 'execution_error',
          message: err.message || 'Unknown error',
          location: { file: tmpFile },
        },
      ],
      warnings: [],
    }
  } finally {
    require('node:fs').unlinkSync(tmpFile)
  }
}

async function runDrc(pcb: string): Promise<DrcResult> {
  const { exec } = require('node:child_process')
  const { promisify } = require('node:util')
  const execAsync = promisify(exec)

  const tmpFile = `/tmp/tmp_${Date.now()}.kicad_pcb`
  require('node:fs').writeFileSync(tmpFile, pcb)

  try {
    const { stdout } = await execAsync(
      `kicad-cli pcb drc --output - --format json --exit-code-violations "${tmpFile}"`,
    )

    try {
      const parsed = JSON.parse(stdout)
      return {
        exitCode: 0,
        report: stdout,
        errors:
          parsed.violations?.map(
            (v: {
              type?: string
              description?: string
              message?: string
              position?: { x?: string; y?: string }
              layer?: string
            }) => ({
              type: v.type || 'drc_error',
              message: v.description || v.message,
              location: {
                x: v.position?.x || '0',
                y: v.position?.y || '0',
                layer: v.layer,
              },
            }),
          ) || [],
        warnings: [],
      }
    } catch {
      return {
        exitCode: 0,
        report: stdout,
        errors: [],
        warnings: [],
      }
    }
  } catch (error: unknown) {
    const err = error as { exitCode?: number; message?: string }
    return {
      exitCode: err.exitCode || 1,
      report: err.message || 'Unknown error',
      errors: [
        {
          type: 'execution_error',
          message: err.message || 'Unknown error',
        },
      ],
      warnings: [],
    }
  } finally {
    require('node:fs').unlinkSync(tmpFile)
  }
}

async function generateGerber(pcb: string): Record<string, string> {
  const { exec } = require('node:child_process')
  const { promisify } = require('node:util')
  const execAsync = promisify(exec)

  const tmpDir = `/tmp/gerber_${Date.now()}`
  const tmpFile = `${tmpDir}/board.kicad_pcb`

  require('node:fs').mkdirSync(tmpDir, { recursive: true })
  require('node:fs').writeFileSync(tmpFile, pcb)

  try {
    await execAsync(`kicad-cli pcb export gerbers --output "${tmpDir}/" "${tmpFile}"`)

    const gerbers: Record<string, string> = {}
    const files = require('node:fs').readdirSync(tmpDir)

    for (const file of files) {
      if (file.endsWith('.gbr')) {
        gerbers[file] = require('node:fs').readFileSync(`${tmpDir}/${file}`, 'utf-8')
      }
    }

    return gerbers
  } finally {
    require('node:fs').rmSync(tmpDir, { recursive: true, force: true })
  }
}

async function generateBom(sch: string): Array<{ [key: string]: string }> {
  const { exec } = require('node:child_process')
  const { promisify } = require('node:util')
  const execAsync = promisify(exec)

  const tmpFile = `/tmp/tmp_${Date.now()}.kicad_sch`
  require('node:fs').writeFileSync(tmpFile, sch)

  try {
    const { stdout } = await execAsync(`kibot -s run_drc -b "${tmpFile.replace('.kicad_sch', '')}"`)

    return JSON.parse(stdout || '[]')
  } finally {
    require('node:fs').unlinkSync(tmpFile)
  }
}
