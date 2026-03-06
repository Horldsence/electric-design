import { createPipelineLogger } from '../../lib/debug'
import type {
  BomEntry,
  DrcResult,
  ErcResult,
  GerberFiles,
  KiBotOutput,
  PostProcessOptions,
} from '../../types/kicad'
import { KiCadValidationError } from '../pipeline/error-handler'

/**
 * KiCad CLI wrapper class
 * Handles finding and executing kicad-cli binary
 */
class KiCadCli {
  private binaryPath?: string
  private log = createPipelineLogger('kicad-cli', 'global')

  /**
   * Find KiCad CLI binary on the system
   * Checks common installation paths for different platforms
   */
  async findBinary(): Promise<string> {
    if (this.binaryPath) return this.binaryPath

    const platform = process.platform
    const { existsSync } = await import('node:fs')

    if (platform === 'darwin') {
      const paths = [
        '/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli',
        '/Applications/KiCad 9/KiCad.app/Contents/MacOS/kicad-cli',
        '/Applications/KiCad 8/KiCad.app/Contents/MacOS/kicad-cli',
        '/Applications/KiCad 7/KiCad.app/Contents/MacOS/kicad-cli',
        '/opt/homebrew/bin/kicad-cli',
        '/usr/local/bin/kicad-cli',
      ]
      for (const path of paths) {
        if (existsSync(path)) {
          this.log.info('Found KiCad CLI', { path })
          this.binaryPath = path
          return this.binaryPath
        }
      }
    } else if (platform === 'win32') {
      const { join } = await import('node:path')
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
      const paths = [
        join(programFiles, 'KiCad', '9.0', 'bin', 'kicad-cli.exe'),
        join(programFiles, 'KiCad', '8.0', 'bin', 'kicad-cli.exe'),
        join(programFiles, 'KiCad', '7.0', 'bin', 'kicad-cli.exe'),
        join(programFilesX86, 'KiCad', '9.0', 'bin', 'kicad-cli.exe'),
        join(programFilesX86, 'KiCad', '8.0', 'bin', 'kicad-cli.exe'),
      ]
      for (const path of paths) {
        if (existsSync(path)) {
          this.log.info('Found KiCad CLI', { path })
          this.binaryPath = path
          return this.binaryPath
        }
      }
    } else if (platform === 'linux') {
      const paths = [
        '/usr/bin/kicad-cli',
        '/usr/local/bin/kicad-cli',
        '/snap/bin/kicad-cli',
        '/opt/kicad/bin/kicad-cli',
      ]
      for (const path of paths) {
        if (existsSync(path)) {
          this.log.info('Found KiCad CLI', { path })
          this.binaryPath = path
          return this.binaryPath
        }
      }
    }

    // Fallback to PATH
    this.log.warn('KiCad CLI not found in standard locations, trying PATH')
    this.binaryPath = 'kicad-cli'
    return this.binaryPath
  }

  /**
   * Execute kicad-cli command with arguments
   */
  async exec(
    command: string,
    args: string[],
    timeout = 60000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const binary = await this.findBinary()
    const fullArgs = [command, ...args]

    this.log.debug('Executing KiCad CLI', { binary, command, args: fullArgs })

    const proc = Bun.spawn([binary, ...fullArgs], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: this.cleanEnv(),
    })

    const timer = setTimeout(() => {
      this.log.warn('KiCad CLI timeout, killing process', { timeout })
      proc.kill()
    }, timeout)

    try {
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited

      clearTimeout(timer)

      if (exitCode !== 0) {
        this.log.warn('KiCad CLI non-zero exit', { exitCode, stderr: stderr.substring(0, 500) })
      }

      return { stdout, stderr, exitCode }
    } catch (error) {
      clearTimeout(timer)
      throw new Error(`KiCad CLI execution failed: ${error}`)
    }
  }

  /**
   * Clean environment variables to avoid conflicts
   * Especially important for Python virtual environments
   */
  private cleanEnv(): Record<string, string> {
    const env: Record<string, string> = {}

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value
      }
    }

    // Remove Python virtual environment variables that might interfere
    if (process.env.VIRTUAL_ENV) {
      env.VIRTUAL_ENV = undefined
      env.PYTHONHOME = undefined

      const venvPath = process.env.VIRTUAL_ENV
      const pathSep = process.platform === 'win32' ? ';' : ':'
      const currentPath = process.env.PATH || ''
      env.PATH = currentPath
        .split(pathSep)
        .filter(dir => !dir.includes(venvPath))
        .join(pathSep)
    }

    return env
  }
}

const cli = new KiCadCli()

/**
 * Parse ERC/DRC violations from JSON output
 */
function parseViolations(
  stdout: string,
  stderr: string,
  exitCode: number,
  checkType: 'erc' | 'drc',
): ErcResult | DrcResult {
  const log = createPipelineLogger('kicad-parser', 'global')

  // Try to parse JSON output
  try {
    const parsed = JSON.parse(stdout || '{}')

    const errors: Array<{ type: string; message: string; location?: Record<string, unknown> }> = []
    const warnings: Array<{ type: string; message: string; location?: Record<string, unknown> }> =
      []

    if (parsed.violations && Array.isArray(parsed.violations)) {
      log.debug('Parsing violations', { count: parsed.violations.length })

      for (const violation of parsed.violations) {
        const entry = {
          type: violation.type || violation.rule || `${checkType}_violation`,
          message: violation.description || violation.message || 'Unknown violation',
          location:
            checkType === 'drc'
              ? { x: violation.x || '0', y: violation.y || '0', layer: violation.layer }
              : { file: violation.file, line: violation.line },
        }

        if (violation.severity === 'warning' || violation.severity === 'excluded') {
          warnings.push(entry)
        } else {
          errors.push(entry)
        }
      }

      // If there are errors, throw validation error
      if (errors.length > 0) {
        throw new KiCadValidationError(
          `${checkType.toUpperCase()} found ${errors.length} error(s) and ${warnings.length} warning(s)`,
          checkType,
          parsed.violations.map((v: Record<string, unknown>) => ({
            type:
              (typeof v.type === 'string' && v.type) ||
              (typeof v.rule === 'string' && v.rule) ||
              `${checkType}_error`,
            description:
              (typeof v.description === 'string' && v.description) ||
              (typeof v.message === 'string' && v.message) ||
              'No description',
            severity: v.severity === 'error' ? 'error' : 'warning',
            position:
              v.x !== undefined
                ? {
                    x: v.x,
                    y: v.y,
                  }
                : undefined,
            items: Array.isArray(v.items) ? v.items : [],
          })),
        )
      }
    }

    return {
      exitCode,
      report: stdout,
      errors,
      warnings,
    }
  } catch (error) {
    // If it's already a KiCadValidationError, rethrow it
    if (error instanceof KiCadValidationError) {
      throw error
    }

    // Otherwise, parse text output
    log.warn('Failed to parse JSON, falling back to text parsing', { error })
    return parseTextOutput(stdout, stderr, exitCode, checkType)
  }
}

/**
 * Parse text output when JSON is not available
 */
function parseTextOutput(
  stdout: string,
  stderr: string,
  exitCode: number,
  checkType: 'erc' | 'drc',
): ErcResult | DrcResult {
  const errors: Array<{ type: string; message: string; location?: Record<string, unknown> }> = []
  const warnings: Array<{ type: string; message: string; location?: Record<string, unknown> }> = []

  const combinedOutput = `${stdout}\n${stderr}`
  const lines = combinedOutput.split('\n')

  // Simple pattern matching for common error formats
  const errorPatterns = [/ERROR|Error|error/i, /FAIL|Fail|fail/i, /violation/i]

  const warningPatterns = [/WARNING|Warning|warning/i, /WARN|Warn|warn/i]

  for (const line of lines) {
    if (!line.trim()) continue

    const isError = errorPatterns.some(pattern => pattern.test(line))
    const isWarning = warningPatterns.some(pattern => pattern.test(line))

    if (isError) {
      errors.push({
        type: `${checkType}_error`,
        message: line.trim(),
      })
    } else if (isWarning) {
      warnings.push({
        type: `${checkType}_warning`,
        message: line.trim(),
      })
    }
  }

  // If exit code is non-zero and we found no errors, treat as error
  if (exitCode !== 0 && errors.length === 0) {
    errors.push({
      type: `${checkType}_unknown`,
      message: `${checkType.toUpperCase()} check failed with exit code ${exitCode}`,
    })
  }

  return {
    exitCode,
    report: combinedOutput,
    errors,
    warnings,
  }
}

/**
 * Execute KiCad CLI command with a temporary file
 */
async function execKiCadCLI(
  command: string,
  args: string[],
  content: string,
  fileType: 'sch' | 'pcb',
  checkType: 'erc' | 'drc',
  sessionId?: string,
): Promise<ErcResult | DrcResult> {
  const log = createPipelineLogger('kicad-exec', sessionId || 'unknown')
  const { writeFileSync, unlinkSync, existsSync, mkdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { randomBytes } = await import('node:crypto')

  const tmpDir = '/tmp/kicad_checks'
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true })
  }

  const tmpFile = join(tmpDir, `check_${randomBytes(8).toString('hex')}.kicad_${fileType}`)

  log.debug('Writing temporary file', { tmpFile, size: content.length })
  writeFileSync(tmpFile, content)

  try {
    const finalArgs = args.map(arg => (arg === '{file}' ? tmpFile : arg))
    const { stdout, stderr, exitCode } = await cli.exec(command, finalArgs)

    log.debug('Command completed', {
      exitCode,
      stdoutLength: stdout.length,
      stderrLength: stderr.length,
    })

    return parseViolations(stdout, stderr, exitCode, checkType)
  } finally {
    if (existsSync(tmpFile)) {
      unlinkSync(tmpFile)
      log.debug('Cleaned up temporary file', { tmpFile })
    }
  }
}

/**
 * Run Electrical Rule Check (ERC) on schematic
 */
export async function runErc(sch: string, sessionId?: string): Promise<ErcResult> {
  const log = createPipelineLogger('kicad-erc', sessionId || 'unknown')
  log.info('Starting ERC check')

  const args = ['erc', '--format', 'json', '--output', '-', '--exit-code-violations', '{file}']

  try {
    const result = await execKiCadCLI('sch', args, sch, 'sch', 'erc', sessionId)
    log.info('ERC check completed', {
      errors: result.errors.length,
      warnings: result.warnings.length,
    })
    return result as ErcResult
  } catch (error) {
    if (error instanceof KiCadValidationError) {
      log.error('ERC check failed', {
        violations: error.violations.length,
        message: error.message,
      })
      throw error
    }
    log.error('ERC check error', error)
    throw new Error(`ERC check failed: ${error}`)
  }
}

/**
 * Run Design Rule Check (DRC) on PCB
 */
export async function runDrc(pcb: string, sessionId?: string): Promise<DrcResult> {
  const log = createPipelineLogger('kicad-drc', sessionId || 'unknown')
  log.info('Starting DRC check')

  const args = [
    'drc',
    '--format',
    'json',
    '--output',
    '-',
    '--exit-code-violations',
    '--refill-zones',
    '{file}',
  ]

  try {
    const result = await execKiCadCLI('pcb', args, pcb, 'pcb', 'drc', sessionId)
    log.info('DRC check completed', {
      errors: result.errors.length,
      warnings: result.warnings.length,
    })
    return result as DrcResult
  } catch (error) {
    if (error instanceof KiCadValidationError) {
      log.error('DRC check failed', {
        violations: error.violations.length,
        message: error.message,
      })
      throw error
    }
    log.error('DRC check error', error)
    throw new Error(`DRC check failed: ${error}`)
  }
}

/**
 * Generate Gerber files from PCB
 */
export async function generateGerber(pcb: string, sessionId?: string): Promise<GerberFiles> {
  const log = createPipelineLogger('kicad-gerber', sessionId || 'unknown')
  const { mkdirSync, rmSync, readdirSync, readFileSync, existsSync, writeFileSync } = await import(
    'node:fs'
  )
  const { join } = await import('node:path')
  const { randomBytes } = await import('node:crypto')

  const tmpDir = join('/tmp', `gerber_${randomBytes(8).toString('hex')}`)
  const tmpFile = join(tmpDir, 'board.kicad_pcb')

  log.info('Generating Gerber files', { tmpDir })

  mkdirSync(tmpDir, { recursive: true })
  writeFileSync(tmpFile, pcb)

  try {
    const args = ['export', 'gerbers', '--output', `${tmpDir}/`, tmpFile]

    await cli.exec('pcb', args, 120000) // 2 minute timeout for Gerber generation

    const gerbers: GerberFiles = {}
    const files = readdirSync(tmpDir)

    log.debug('Generated files', { count: files.length, files })

    for (const file of files) {
      if (
        file.endsWith('.gbr') ||
        file.endsWith('.gko') ||
        file.endsWith('.gto') ||
        file.endsWith('.gtp') ||
        file.endsWith('.gts') ||
        file.endsWith('.gtl') ||
        file.endsWith('.gbl') ||
        file.endsWith('.gbs') ||
        file.endsWith('.gbp') ||
        file.endsWith('.gbo')
      ) {
        gerbers[file] = readFileSync(join(tmpDir, file), 'utf-8')
      }
    }

    log.info('Gerber generation completed', { fileCount: Object.keys(gerbers).length })
    return gerbers
  } catch (error) {
    log.error('Gerber generation failed', error)
    throw new Error(`Gerber generation failed: ${error}`)
  } finally {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true })
      log.debug('Cleaned up temporary directory', { tmpDir })
    }
  }
}

/**
 * Generate Bill of Materials (BOM) from schematic
 */
export async function generateBom(sch: string, sessionId?: string): Promise<BomEntry[]> {
  const log = createPipelineLogger('kicad-bom', sessionId || 'unknown')
  const { writeFileSync, unlinkSync, existsSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { randomBytes } = await import('node:crypto')

  const tmpBase = join('/tmp', `bom_${randomBytes(8).toString('hex')}`)
  const tmpFile = `${tmpBase}.kicad_sch`
  const csvFile = `${tmpBase}.csv`

  log.info('Generating BOM')

  writeFileSync(tmpFile, sch)

  try {
    const args = ['export', 'bom', '--output', csvFile, '--format', 'csv', tmpFile]

    await cli.exec('sch', args, 60000)

    // Parse CSV if it exists
    if (existsSync(csvFile)) {
      const csvContent = readFileSync(csvFile, 'utf-8')
      const bom = parseBomCsv(csvContent)
      log.info('BOM generation completed', { itemCount: bom.length })
      return bom
    }

    log.warn('BOM file not generated')
    return []
  } catch (error) {
    log.error('BOM generation failed', error)
    // Don't throw, just return empty array
    return []
  } finally {
    if (existsSync(tmpFile)) unlinkSync(tmpFile)
    if (existsSync(csvFile)) unlinkSync(csvFile)
    if (existsSync(`${tmpBase}.kicad_pro`)) unlinkSync(`${tmpBase}.kicad_pro`)
  }
}

/**
 * Parse BOM CSV format
 */
function parseBomCsv(csv: string): BomEntry[] {
  const lines = csv.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const bom: BomEntry[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    if (values.length < headers.length) continue

    const entry: BomEntry = {
      designator: values[headers.indexOf('Reference')] || values[0] || '',
      value: values[headers.indexOf('Value')] || values[1] || '',
      footprint: values[headers.indexOf('Footprint')] || values[2] || '',
      quantity: 1,
    }

    // Add other properties
    for (let j = 0; j < headers.length; j++) {
      if (!['Reference', 'Value', 'Footprint'].includes(headers[j])) {
        entry[headers[j]] = values[j]
      }
    }

    bom.push(entry)
  }

  return bom
}

/**
 * Post-process KiCad files with various checks and exports
 */
export async function postProcess(
  kicadFiles: { pcb: string; sch: string },
  options: PostProcessOptions,
  sessionId?: string,
): Promise<KiBotOutput> {
  const log = createPipelineLogger('kicad-postprocess', sessionId || 'unknown')
  const result: KiBotOutput = {}

  log.info('Starting post-processing', { options })

  try {
    if (options.runErc) {
      log.info('Running ERC')
      await runErc(kicadFiles.sch, sessionId)
      log.info('✓ ERC passed')
    }

    if (options.runDrc) {
      log.info('Running DRC')
      await runDrc(kicadFiles.pcb, sessionId)
      log.info('✓ DRC passed')
    }

    if (options.generateGerber) {
      log.info('Generating Gerbers')
      result.gerbers = await generateGerber(kicadFiles.pcb, sessionId)
      log.info('✓ Gerbers generated', { count: Object.keys(result.gerbers).length })
    }

    if (options.generateBom) {
      log.info('Generating BOM')
      result.bom = await generateBom(kicadFiles.sch, sessionId)
      log.info('✓ BOM generated', { itemCount: result.bom.length })
    }

    log.info('Post-processing completed successfully')
    return result
  } catch (error) {
    log.error('Post-processing failed', error)
    throw error
  }
}

/**
 * Check if KiCad CLI is available on the system
 */
export async function checkKiCadAvailability(): Promise<{
  available: boolean
  version?: string
  path?: string
}> {
  try {
    const binary = await cli.findBinary()
    const { stdout } = await cli.exec('version', [], 5000)

    return {
      available: true,
      version: stdout.trim(),
      path: binary,
    }
  } catch (_error) {
    return {
      available: false,
    }
  }
}
