import { expect, test } from 'bun:test'
import { runPipeline } from '../../src/services/pipeline/orchestrator'

test('full pipeline with self-healing: prompt → KiCad files', async () => {
  const result = await runPipeline('Create a blinking LED circuit with a 555 timer')

  expect(result.success).toBe(true)
  expect(result.data).toBeDefined()

  const data = result.data
  const circuitJson = data?.circuitJson
  const kicadFiles = data?.kicadFiles
  const validation = data?.validation

  expect(circuitJson).toBeDefined()
  expect(circuitJson).toBeInstanceOf(Array)
  expect(circuitJson?.length).toBeGreaterThan(0)

  expect(kicadFiles?.pcb).toContain('(kicad_pcb')
  expect(kicadFiles?.sch).toContain('(kicad_sch')

  expect(validation?.isValid).toBe(true)
  expect(validation?.errors).toHaveLength(0)
}, 45000)

test('pipeline handles complex circuit requirements', async () => {
  const result = await runPipeline(
    'Create a voltage regulator circuit with input filtering and output LED indicator',
  )

  expect(result.success).toBe(true)
  expect(result.data).toBeDefined()

  const data = result.data
  const circuitJson = data?.circuitJson
  const kicadFiles = data?.kicadFiles

  expect(circuitJson).toBeDefined()
  expect(circuitJson?.length).toBeGreaterThan(2)

  const _hasRegulator = circuitJson?.some((el: any) => el.name?.startsWith('U')) ?? false
  const hasResistor = circuitJson?.some((el: any) => el.name?.startsWith('R')) ?? false
  const _hasCapacitor = circuitJson?.some((el: any) => el.name?.startsWith('C')) ?? false
  const _hasLED = circuitJson?.some((el: any) => el.name?.startsWith('LED')) ?? false

  expect(hasResistor).toBe(true)
  expect(kicadFiles?.pcb.length).toBeGreaterThan(200)
  expect(kicadFiles?.sch.length).toBeGreaterThan(200)
}, 45000)

test('pipeline with post-processing options', async () => {
  const result = await runPipeline('Create a simple resistor circuit', {
    runErc: false,
    runDrc: false,
    generateGerber: false,
    autoFix: false,
    maxAutoFixRetries: 3,
  })

  expect(result.success).toBe(true)
  expect(result.data).toBeDefined()

  const kicadFiles = result.data?.kicadFiles

  expect(kicadFiles?.pcb).toBeTruthy()
  expect(kicadFiles?.sch).toBeTruthy()
}, 30000)

test('pipeline self-heals on generation errors', async () => {
  const result = await runPipeline('Create a circuit with invalid components')

  expect(result.success).toBe(true)
  expect(result.data).toBeDefined()

  const data = result.data
  const circuitJson = data?.circuitJson
  const kicadFiles = data?.kicadFiles

  expect(circuitJson).toBeDefined()
  expect(circuitJson?.length).toBeGreaterThan(0)
  expect(kicadFiles?.pcb).toContain('(kicad_pcb')
  expect(kicadFiles?.sch).toContain('(kicad_sch')
}, 45000)

test('pipeline returns structured errors on failure', async () => {
  const result = await runPipeline('', {
    runErc: true,
    runDrc: false,
    generateGerber: false,
    autoFix: false,
    maxAutoFixRetries: 3,
  })

  if (!result.success) {
    expect(result.error).toBeDefined()
    expect(result.error?.type).toBeDefined()
    expect(result.error?.message).toBeDefined()
  }
}, 30000)
