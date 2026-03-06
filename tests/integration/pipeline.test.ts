import { test, expect } from "bun:test"
import { compilerService } from "../../src/services/tscircuit/compiler"
import { convertToKiCad } from "../../src/services/kicad/converter"

test("simple resistor circuit - full pipeline", async () => {
  const code = `
    export default () => (
      <board width="20mm" height="20mm">
        <resistor name="R1" resistance="1k" footprint="0402" />
      </board>
    )
  `

  const sessionId = `test_${Date.now()}`

  const compileResult = await compilerService.compile(sessionId, code)

  expect(compileResult.errors).toBeUndefined()
  expect(compileResult.circuitJson).toBeInstanceOf(Array)
  expect(compileResult.circuitJson.length).toBeGreaterThan(0)

  const resistor = compileResult.circuitJson.find((el: any) => el.name === "R1")
  expect(resistor).toBeDefined()
  expect(resistor?.type).toBe("source_component")

  const kicadFiles = convertToKiCad(compileResult.circuitJson)

  expect(kicadFiles.pcb).toContain("(kicad_pcb")
  expect(kicadFiles.sch).toContain("(kicad_sch")

  compilerService.cleanup(sessionId)
})

test("resistor + LED circuit - full pipeline", async () => {
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

  expect(compileResult.errors).toBeUndefined()
  expect(compileResult.circuitJson.length).toBeGreaterThan(1)

  const resistor = compileResult.circuitJson.find((el: any) => el.name === "R1")
  const led = compileResult.circuitJson.find((el: any) => el.name === "LED1")

  expect(resistor).toBeDefined()
  expect(led).toBeDefined()

  const kicadFiles = convertToKiCad(compileResult.circuitJson)

  expect(kicadFiles.pcb.length).toBeGreaterThan(100)
  expect(kicadFiles.sch.length).toBeGreaterThan(100)

  compilerService.cleanup(sessionId)
})

test("simple chip circuit - full pipeline", async () => {
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

  expect(compileResult.errors).toBeUndefined()
  expect(compileResult.circuitJson.length).toBeGreaterThan(2)

  const chip = compileResult.circuitJson.find((el: any) => el.name === "U1")
  expect(chip).toBeDefined()
  expect(chip?.type).toBe("source_component")
  expect(chip?.ftype).toBe("simple_chip")

  const kicadFiles = convertToKiCad(compileResult.circuitJson)

  expect(kicadFiles.pcb).toContain("footprint")
  expect(kicadFiles.sch).toContain("symbol")

  compilerService.cleanup(sessionId)
})
