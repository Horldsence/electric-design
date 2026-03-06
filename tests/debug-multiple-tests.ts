import { generateCode } from '../src/services/ai/code-generator'

async function testMultipleCircuits() {
  console.log('\n=== Test 1: Simple LED ===\n')
  const result1 = await generateCode('Create a simple LED circuit with one resistor')
  console.log(result1.code)

  console.log('\n\n=== Test 2: RC Filter ===\n')
  const result2 = await generateCode('Create an RC low-pass filter circuit')
  console.log(result2.code)

  console.log('\n\n=== Test 3: Voltage Regulator ===\n')
  const result3 = await generateCode('Create a 5V voltage regulator with capacitors')
  console.log(result3.code)
}

testMultipleCircuits().catch(console.error)
