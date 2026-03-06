import type { PostProcessOptions, KiBotOutput, ErcResult, DrcResult } from "../../types/kicad"

export async function postProcess(
  kicadFiles: { pcb: string; sch: string },
  options: PostProcessOptions
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
  const { exec } = require("child_process")
  const { promisify } = require("util")
  const execAsync = promisify(exec)

  const tmpFile = `/tmp/tmp_${Date.now()}.kicad_sch`
  require("fs").writeFileSync(tmpFile, sch)

  try {
    const { stdout, stderr } = await execAsync(
      `kicad-cli sch erc --output - --format json --exit-code-violations "${tmpFile}"`
    )

    try {
      const parsed = JSON.parse(stdout)
      return {
        exitCode: 0,
        report: stdout,
        errors: parsed.violations?.map((v: any) => ({
          type: v.type || "erc_error",
          message: v.description || v.message,
          location: {
            file: tmpFile,
            line: v.lineNumber
          }
        })) || [],
        warnings: []
      }
    } catch {
      return {
        exitCode: 0,
        report: stdout,
        errors: [],
        warnings: []
      }
    }
  } catch (error: any) {
    return {
      exitCode: error.exitCode || 1,
      report: stderr || error.message,
      errors: [{
        type: "execution_error",
        message: error.message,
        location: { file: tmpFile }
      }],
      warnings: []
    }
  } finally {
    require("fs").unlinkSync(tmpFile)
  }
}

async function runDrc(pcb: string): Promise<DrcResult> {
  const { exec } = require("child_process")
  const { promisify } = require("util")
  const execAsync = promisify(exec)

  const tmpFile = `/tmp/tmp_${Date.now()}.kicad_pcb`
  require("fs").writeFileSync(tmpFile, pcb)

  try {
    const { stdout, stderr } = await execAsync(
      `kicad-cli pcb drc --output - --format json --exit-code-violations "${tmpFile}"`
    )

    try {
      const parsed = JSON.parse(stdout)
      return {
        exitCode: 0,
        report: stdout,
        errors: parsed.violations?.map((v: any) => ({
          type: v.type || "drc_error",
          message: v.description || v.message,
          location: {
            x: v.position?.x || "0",
            y: v.position?.y || "0",
            layer: v.layer
          }
        })) || [],
        warnings: []
      }
    } catch {
      return {
        exitCode: 0,
        report: stdout,
        errors: [],
        warnings: []
      }
    }
  } catch (error: any) {
    return {
      exitCode: error.exitCode || 1,
      report: stderr || error.message,
      errors: [{
        type: "execution_error",
        message: error.message
      }],
      warnings: []
    }
  } finally {
    require("fs").unlinkSync(tmpFile)
  }
}

async function generateGerber(pcb: string): Record<string, string> {
  const { exec } = require("child_process")
  const { promisify } = require("util")
  const execAsync = promisify(exec)

  const tmpDir = `/tmp/gerber_${Date.now()}`
  const tmpFile = `${tmpDir}/board.kicad_pcb`

  require("fs").mkdirSync(tmpDir, { recursive: true })
  require("fs").writeFileSync(tmpFile, pcb)

  try {
    await execAsync(`kicad-cli pcb export gerbers --output "${tmpDir}/" "${tmpFile}"`)

    const gerbers: Record<string, string> = {}
    const files = require("fs").readdirSync(tmpDir)

    for (const file of files) {
      if (file.endsWith(".gbr")) {
        gerbers[file] = require("fs").readFileSync(`${tmpDir}/${file}`, "utf-8")
      }
    }

    return gerbers
  } finally {
    require("fs").rmSync(tmpDir, { recursive: true, force: true })
  }
}

async function generateBom(sch: string): Array<{ [key: string]: string }> {
  const { exec } = require("child_process")
  const { promisify } = require("util")
  const execAsync = promisify(exec)

  const tmpFile = `/tmp/tmp_${Date.now()}.kicad_sch`
  require("fs").writeFileSync(tmpFile, sch)

  try {
    const { stdout } = await execAsync(
      `kibot -s run_drc -b "${tmpFile.replace('.kicad_sch', '')}"`
    )

    return JSON.parse(stdout || "[]")
  } finally {
    require("fs").unlinkSync(tmpFile)
  }
}
