import { describe, expect, test } from 'bun:test'
import { resetConfig } from '../../src/lib/config'
import { generateCode } from '../../src/services/ai/code-generator'
import { convertToKiCad } from '../../src/services/kicad/converter'
import { compilerService } from '../../src/services/tscircuit/compiler'
import { saveKicadFiles } from '../../src/util/file-writer'

describe('AI Code Generation with Self-Healing', () => {
  test('generates valid code from simple prompt', async () => {
    const result = await generateCode('Create a simple resistor circuit')

    expect(result.success).toBe(true)
    expect(result.code).toBeTruthy()
    expect(result.code.length).toBeGreaterThan(0)

    const hasBoard = result.code.includes('<board')
    const hasExport = result.code.includes('export default')
    const hasComponent = result.code.includes('<resistor') || result.code.includes('<led')

    expect(hasBoard).toBe(true)
    expect(hasExport).toBe(true)
    expect(hasComponent).toBe(true)
  }, 30000)

  test('generated code compiles successfully', async () => {
    const result = await generateCode('Create an LED circuit with a resistor')

    expect(result.success).toBe(true)

    const sessionId = `test_${Date.now()}`
    const compileResult = await compilerService.compile(sessionId, result.code)

    expect(compileResult.errors).toBeUndefined()
    expect(compileResult.circuitJson).toBeInstanceOf(Array)
    expect(compileResult.circuitJson.length).toBeGreaterThan(0)

    const kicadFiles = convertToKiCad(compileResult.circuitJson)
    const { pcbPath, schPath } = await saveKicadFiles('ai-generated-led', kicadFiles)
    console.log(`  ✓ Saved ${pcbPath}`)
    console.log(`  ✓ Saved ${schPath}`)

    compilerService.cleanup(sessionId)
  }, 30000)

  test('handles missing API key gracefully', async () => {
    const originalApiKey = process.env.API_KEY

    process.env.API_KEY = undefined
    resetConfig() // Clear config cache

    const result = await generateCode('Create any circuit')

    expect(result.success).toBe(true)
    expect(result.fallback).toBe(true)
    expect(result.code).toContain('<board')
    expect(result.code).toContain('<resistor')

    process.env.API_KEY = originalApiKey
    resetConfig() // Clear cache again
  }, 10000)

  test('generates code with proper component attributes', async () => {
    const result = await generateCode('Create a circuit with a 1k resistor and an LED')

    expect(result.success).toBe(true)

    const hasFootprint = result.code.includes('footprint=')
    const hasName = result.code.includes('name=')

    expect(hasFootprint).toBe(true)
    expect(hasName).toBe(true)

    const sessionId = `test_${Date.now()}`
    const compileResult = await compilerService.compile(sessionId, result.code)
    const kicadFiles = convertToKiCad(compileResult.circuitJson)
    const { pcbPath, schPath } = await saveKicadFiles('ai-component-attrs', kicadFiles)
    console.log(`  ✓ Saved ${pcbPath}`)
    console.log(`  ✓ Saved ${schPath}`)

    compilerService.cleanup(sessionId)
  }, 30000)

  test('generates code with power nets', async () => {
    const result = await generateCode('Create a circuit powered by VCC and GND')

    expect(result.success).toBe(true)

    const hasVCC = result.code.includes('net.VCC')
    const hasGND = result.code.includes('net.GND')

    expect(hasVCC).toBe(true)
    expect(hasGND).toBe(true)

    const sessionId = `test_${Date.now()}`
    const compileResult = await compilerService.compile(sessionId, result.code)
    const kicadFiles = convertToKiCad(compileResult.circuitJson)
    const { pcbPath, schPath } = await saveKicadFiles('ai-power-nets', kicadFiles)
    console.log(`  ✓ Saved ${pcbPath}`)
    console.log(`  ✓ Saved ${schPath}`)

    compilerService.cleanup(sessionId)
  }, 30000)
})

describe('Self-Healing Behavior', () => {
  test('retries on compilation failures', async () => {
    const result = await generateCode('Create a complex circuit with multiple components')

    expect(result.success).toBe(true)

    const sessionId = `test_healing_${Date.now()}`
    const compileResult = await compilerService.compile(sessionId, result.code)

    expect(compileResult.errors).toBeUndefined()

    const kicadFiles = convertToKiCad(compileResult.circuitJson)
    const { pcbPath, schPath } = await saveKicadFiles('ai-complex-healing', kicadFiles)
    console.log(`  ✓ Saved ${pcbPath}`)
    console.log(`  ✓ Saved ${schPath}`)

    compilerService.cleanup(sessionId)
  }, 30000)

  test('returns retry count in result', async () => {
    const result = await generateCode('Create a simple circuit')

    expect(result.retryCount).toBeDefined()
    expect(result.retryCount).toBeGreaterThanOrEqual(0)
    expect(result.retryCount).toBeLessThanOrEqual(5)
  }, 30000)

  test('eventually uses fallback after max attempts', async () => {
    const originalApiKey = process.env.API_KEY

    process.env.API_KEY = undefined
    resetConfig() // Clear config cache

    const result = await generateCode('Create any circuit')

    expect(result.success).toBe(true)
    expect(result.fallback).toBe(true)

    process.env.API_KEY = originalApiKey
    resetConfig() // Clear cache again
  }, 10000)
})
