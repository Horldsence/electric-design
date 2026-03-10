import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FileManager } from '../src/lib/file-manager'

async function testWorkspaceFileEdit() {
  const testWorkspacePath = join(process.cwd(), 'tests', 'output', 'test-workspace')

  console.log('🧪 Testing workspace file editing functionality')

  try {
    await mkdir(testWorkspacePath, { recursive: true })

    const fileManager = new FileManager(testWorkspacePath)

    console.log('\n1️⃣ Initializing workspace...')
    await fileManager.init({ path: testWorkspacePath, name: 'test-workspace' })

    console.log('2️⃣ Creating test version...')
    const testCode = `export default () => (
  <board width="30mm" height="20mm">
    <resistor name="R1" resistance="1k" />
  </board>
)`

    const versionId = await fileManager.createVersion({
      code: testCode,
      prompt: 'Create a simple resistor circuit',
      timestamp: Date.now(),
      isValid: true,
    })

    console.log(`   ✅ Version created: ${versionId}`)

    console.log('\n3️⃣ Reading version code...')
    const originalCode = await fileManager.readVersionCode(versionId)
    console.log(`   ✅ Original code length: ${originalCode?.length}`)
    console.log(`   📄 Code preview: ${originalCode?.substring(0, 50)}...`)

    console.log('\n4️⃣ Updating version code...')
    const updatedCode = `export default () => (
  <board width="40mm" height="30mm">
    <resistor name="R1" resistance="1k" footprint="0402" />
    <led name="LED1" footprint="0603" />
    <trace from=".R1 > .pin1" to="net.VCC" />
    <trace from=".R1 > .pin2" to=".LED1 > .pos" />
    <trace from=".LED1 > .neg" to="net.GND" />
  </board>
)`

    await fileManager.updateVersionCode(versionId, updatedCode, true)
    console.log(`   ✅ Code updated, length: ${updatedCode.length}`)

    console.log('\n5️⃣ Reading updated code...')
    const newCode = await fileManager.readVersionCode(versionId)
    console.log(`   ✅ Updated code length: ${newCode?.length}`)
    console.log(`   📄 Code preview: ${newCode?.substring(0, 50)}...`)

    if (newCode === updatedCode) {
      console.log('\n✅ SUCCESS: Code update verified!')
    } else {
      console.log('\n❌ FAILURE: Code mismatch!')
      console.log(`Expected length: ${updatedCode.length}`)
      console.log(`Actual length: ${newCode?.length}`)
    }

    console.log('\n6️⃣ Checking workspace meta...')
    const meta = await fileManager.getMeta()
    console.log(`   ✅ Workspace name: ${meta?.name}`)
    console.log(`   ✅ Versions count: ${meta?.versions.length}`)
    console.log(`   ✅ Current version: ${meta?.currentVersion}`)

    const version = meta?.versions.find(v => v.id === versionId)
    console.log(`   ✅ Version isValid: ${version?.isValid}`)

    console.log('\n✨ All tests passed!')
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

await testWorkspaceFileEdit()
