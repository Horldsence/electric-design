import { describe, expect, test } from 'bun:test'
import { convertToKiCad } from '../../src/services/kicad/converter'
import { postProcess } from '../../src/services/kicad/validator'
import { KiCadValidationError } from '../../src/services/pipeline/error-handler'
import { compilerService } from '../../src/services/tscircuit/compiler'

describe('KiCad CLI integration', () => {
  let kicadInstalled = false

  try {
    const proc = Bun.spawn(['kicad-cli', '--version'], { stdout: 'pipe', stderr: 'pipe' })
    proc.exited.then(code => {
      kicadInstalled = code === 0
    })
  } catch {
    kicadInstalled = false
  }

  test.skipIf(!kicadInstalled, 'simple resistor circuit - ERC passes', async () => {
    const code = `
      export default () => (
        <board width="20mm" height="20mm">
          <resistor name="R1" resistance="1k" footprint="0402" />
        </board>
      )
    `

    const sessionId = `test_erc_${Date.now()}`
    const compileResult = await compilerService.compile(sessionId, code)

    expect(compileResult.errors).toBeUndefined()

    const kicadFiles = convertToKiCad(compileResult.circuitJson)

    await postProcess(kicadFiles, { runErc: true }, sessionId)

    compilerService.cleanup(sessionId)
  })

  test.skipIf(!kicadInstalled, 'simple resistor circuit - DRC passes', async () => {
    const code = `
      export default () => (
        <board width="20mm" height="20mm">
          <resistor name="R1" resistance="1k" footprint="0402" />
        </board>
      )
    `

    const sessionId = `test_drc_${Date.now()}`
    const compileResult = await compilerService.compile(sessionId, code)

    expect(compileResult.errors).toBeUndefined()

    const kicadFiles = convertToKiCad(compileResult.circuitJson)

    await postProcess(kicadFiles, { runDrc: true }, sessionId)

    compilerService.cleanup(sessionId)
  })

  test.skipIf(
    !kicadInstalled,
    'circuit with unconnected pins - ERC should detect violations',
    async () => {
      const code = `
      export default () => (
        <board width="30mm" height="20mm">
          <resistor name="R1" resistance="1k" footprint="0402" />
          <led name="LED1" footprint="0603" />
        </board>
      )
    `

      const sessionId = `test_erc_violations_${Date.now()}`
      const compileResult = await compilerService.compile(sessionId, code)

      expect(compileResult.errors).toBeUndefined()

      const kicadFiles = convertToKiCad(compileResult.circuitJson)

      let caughtError = false
      try {
        await postProcess(kicadFiles, { runErc: true }, sessionId)
      } catch (error) {
        caughtError = true
        expect(error).toBeInstanceOf(KiCadValidationError)
        if (error instanceof KiCadValidationError) {
          expect(error.checkType).toBe('erc')
          expect(error.violations.length).toBeGreaterThan(0)
        }
      } finally {
        compilerService.cleanup(sessionId)
      }

      expect(caughtError).toBe(true)
    },
  )

  test.skipIf(
    !kicadInstalled,
    'circuit with clearance issues - DRC should detect violations',
    async () => {
      const code = `
      export default () => (
        <board width="10mm" height="10mm">
          <resistor name="R1" resistance="1k" footprint="0402" />
          <resistor name="R2" resistance="1k" footprint="0402" />
        </board>
      )
    `

      const sessionId = `test_drc_violations_${Date.now()}`
      const compileResult = await compilerService.compile(sessionId, code)

      expect(compileResult.errors).toBeUndefined()

      const kicadFiles = convertToKiCad(compileResult.circuitJson)

      let caughtError = false
      try {
        await postProcess(kicadFiles, { runDrc: true }, sessionId)
      } catch (error) {
        caughtError = true
        expect(error).toBeInstanceOf(KiCadValidationError)
        if (error instanceof KiCadValidationError) {
          expect(error.checkType).toBe('drc')
          expect(error.violations.length).toBeGreaterThan(0)
        }
      } finally {
        compilerService.cleanup(sessionId)
      }

      expect(caughtError).toBe(true)
    },
  )

  test.skipIf(!kicadInstalled, 'full post-processing - ERC + DRC + Gerber', async () => {
    const code = `
      export default () => (
        <board width="30mm" height="20mm">
          <resistor name="R1" resistance="1k" footprint="0402" />
        </board>
      )
    `

    const sessionId = `test_full_post_${Date.now()}`
    const compileResult = await compilerService.compile(sessionId, code)

    expect(compileResult.errors).toBeUndefined()

    const kicadFiles = convertToKiCad(compileResult.circuitJson)

    const result = await postProcess(
      kicadFiles,
      { runErc: true, runDrc: true, generateGerber: true },
      sessionId,
    )

    expect(result.gerbers).toBeDefined()
    expect(Object.keys(result.gerbers || {}).length).toBeGreaterThan(0)
    compilerService.cleanup(sessionId)
  })
})
