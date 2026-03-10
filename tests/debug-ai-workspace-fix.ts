import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FileManager } from '../src/lib/file-manager'
import { generateCode } from '../src/services/ai/code-generator'

async function testAIWorkspaceFix() {
  const testWorkspacePath = join(process.cwd(), 'tests', 'output', 'ai-fix-test')

  console.log('🧪 Testing AI修复 + Workspace集成\n')

  try {
    await mkdir(testWorkspacePath, { recursive: true })
    const fileManager = new FileManager(testWorkspacePath)

    console.log('1️⃣ 初始化workspace...')
    await fileManager.init({ path: testWorkspacePath, name: 'ai-fix-test' })

    console.log('2️⃣ 创建带错误的初始版本...')
    const errorneousCode = `export default () => (
  <board width="30mm" height="20mm">
    <resistor name="R1" resistance="1k" />
  </board>
)`

    const versionId = await fileManager.createVersion({
      code: errorneousCode,
      prompt: 'Create a resistor circuit',
      timestamp: Date.now(),
      isValid: false,
    })

    console.log(`   ✅ 版本创建: ${versionId}`)
    console.log(`   📄 初始代码: ${errorneousCode.substring(0, 50)}...`)

    console.log('\n3️⃣ 调用AI修复（带workspace参数）...')
    const result = await generateCode('Create a resistor circuit', {
      workspacePath: testWorkspacePath,
      versionId,
    })

    console.log(`   ✅ 修复成功: ${result.success}`)
    console.log(`   🔄 重试次数: ${result.retryCount}`)
    console.log(`   📁 写回workspace: ${result.workspaceFixed}`)
    console.log(`   🆔 版本ID: ${result.versionId}`)

    console.log('\n4️⃣ 验证workspace中的代码...')
    const fixedCode = await fileManager.readVersionCode(versionId)
    console.log(`   📄 修复后代码长度: ${fixedCode?.length}`)
    console.log(`   📄 代码预览: ${fixedCode?.substring(0, 100)}...`)

    console.log('\n5️⃣ 检查workspace元数据...')
    const meta = await fileManager.getMeta()
    const version = meta?.versions.find(v => v.id === versionId)
    console.log(`   ✅ 版本isValid: ${version?.isValid}`)

    if (fixedCode && fixedCode !== errorneousCode) {
      console.log('\n✅ SUCCESS: AI修复成功并写回workspace!')
      console.log(`   原始代码: ${errorneousCode.length} 字符`)
      console.log(`   修复代码: ${fixedCode.length} 字符`)
      console.log(`   差异: ${fixedCode.length - errorneousCode.length} 字符`)
    } else {
      console.log('\n⚠️  WARNING: 代码未变化（可能是fallback）')
    }

    if (result.fallback) {
      console.log('\n⚠️  使用了fallback代码（没有API key）')
    }

    console.log('\n✨ 测试完成!')
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

await testAIWorkspaceFix()
