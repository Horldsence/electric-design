import { test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { convertToKiCad } from '../../src/services/kicad/converter'
import { compilerService } from '../../src/services/tscircuit/compiler'

async function saveKicadFiles(name: string, kicadFiles: { pcb: string; sch: string }) {
  const outputDir = 'tests/output/kicad'
  await mkdir(outputDir, { recursive: true })

  const pcbPath = `${outputDir}/${name}.kicad_pcb`
  const schPath = `${outputDir}/${name}.kicad_sch`

  await Bun.write(pcbPath, kicadFiles.pcb)
  await Bun.write(schPath, kicadFiles.sch)

  console.log(`  ✓ Saved ${pcbPath}`)
  console.log(`  ✓ Saved ${schPath}`)
}

test('simple resistor - save to KiCad files', async () => {
  const code = `
    export default () => (
      <board width="20mm" height="20mm">
        <resistor name="R1" resistance="1k" footprint="0402" />
      </board>
    )
  `

  const sessionId = `test_${Date.now()}`
  const compileResult = await compilerService.compile(sessionId, code)
  const kicadFiles = convertToKiCad(compileResult.circuitJson)

  await saveKicadFiles('simple-resistor', kicadFiles)

  compilerService.cleanup(sessionId)
})

test('resistor + LED - save to KiCad files', async () => {
  const code = `
    export default () => (
      <board width="30mm" height="20mm">
        <resistor name="R1" resistance="1k" footprint="0402" />
        <led name="LED1" footprint="0603" />
      </board>
    )
  `

  const sessionId = `test_${Date.now()}`
  const compileResult = await compilerService.compile(sessionId, code)
  const kicadFiles = convertToKiCad(compileResult.circuitJson)

  await saveKicadFiles('resistor-led', kicadFiles)

  compilerService.cleanup(sessionId)
})

test('chip + resistor + capacitor - save to KiCad files', async () => {
  const code = `
    export default () => (
      <board width="30mm" height="20mm">
        <chip
          name="U1"
          footprint="soic4"
          pinLabels={{
            pin1: "IN",
            pin2: "OUT",
            pin3: "EN",
            pin4: "GND"
          }}
        />
        <resistor name="R1" resistance="10k" footprint="0402" />
        <capacitor name="C1" capacitance="1uF" footprint="0402" />
      </board>
    )
  `

  const sessionId = `test_${Date.now()}`
  const compileResult = await compilerService.compile(sessionId, code)
  const kicadFiles = convertToKiCad(compileResult.circuitJson)

  await saveKicadFiles('chip-rc', kicadFiles)

  compilerService.cleanup(sessionId)
})
