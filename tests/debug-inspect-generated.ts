import { generateCode } from '../src/services/ai/code-generator'

async function testAndInspect() {
  console.log('\n=== Testing AI Code Generation ===\n')

  const result = await generateCode('Create a simple LED circuit with a resistor')

  console.log('Generated Code:')
  console.log('='.repeat(80))
  console.log(result.code)
  console.log('='.repeat(80))

  console.log('\n\nMetadata:')
  console.log('- Success:', result.success)
  console.log('- Fallback:', result.fallback)
  console.log('- Retry Count:', result.retryCount)
  console.log('- Code Length:', result.code.length)
}

testAndInspect().catch(console.error)
