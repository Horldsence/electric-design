import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { FileManager } from '../src/lib/file-manager'
import { generateCode } from '../src/services/ai/code-generator'

async function testAutoVersioning() {
  const testWorkspacePath = join(process.cwd(), 'tests', 'output', 'auto-version-test')

  console.log('🧪 测试自动版本化workspace系统\n')

  try {
    await mkdir(testWorkspacePath, { recursive: true })
    const fileManager = new FileManager(testWorkspacePath)

    console.log('1️⃣ 初始化workspace（自定义名称）...')
    await fileManager.init({ path: testWorkspacePath, name: 'My LED Circuit' })

    const meta = await fileManager.getMeta()
    console.log(`   ✅ Workspace名称: ${meta?.name}`)
    console.log(`   📁 路径: ${testWorkspacePath}`)

    console.log('\n2️⃣ 第一次生成（自动创建version）...')
    const result1 = await generateCode('Create a blinking LED circuit with 555 timer', {
      workspacePath: testWorkspacePath,
    })

    console.log(`   ✅ 生成成功: ${result1.success}`)
    console.log(`   🔄 重试次数: ${result1.retryCount}`)
    console.log(`   📁 写回workspace: ${result1.workspaceFixed}`)

    console.log('\n3️⃣ 手动创建version（模拟用户保存）...')
    const version1Id = await fileManager.createVersion({
      code: result1.code,
      prompt: 'Create a blinking LED circuit with 555 timer',
      timestamp: Date.now(),
      isValid: true,
    })

    console.log(`   ✅ Version创建: ${version1Id}`)

    console.log('\n4️⃣ 第二次生成（AI修复模式）...')
    const result2 = await generateCode('Add more LEDs to the circuit', {
      workspacePath: testWorkspacePath,
      versionId: version1Id,
    })

    console.log(`   ✅ 生成成功: ${result2.success}`)
    console.log(`   🔄 重试次数: ${result2.retryCount}`)
    console.log(`   📁 代码已更新: ${result2.workspaceFixed}`)

    console.log('\n5️⃣ 创建第二个version...')
    const version2Id = await fileManager.createVersion({
      code: result2.code,
      prompt: 'Add more LEDs to the circuit',
      timestamp: Date.now(),
      isValid: true,
    })

    console.log(`   ✅ Version创建: ${version2Id}`)

    console.log('\n6️⃣ 切换到第一个version...')
    await fileManager.checkoutVersion(version1Id)
    console.log(`   ✅ 已切换到: ${version1Id}`)

    console.log('\n7️⃣ 查看workspace状态...')
    const finalMeta = await fileManager.getMeta()
    console.log(`   ✅ Workspace名称: ${finalMeta?.name}`)
    console.log(`   📊 版本数量: ${finalMeta?.versions.length}`)
    console.log(`   📍 当前版本: ${finalMeta?.currentVersion}`)

    console.log('\n8️⃣ 版本列表:')
    finalMeta?.versions.forEach((v, idx) => {
      const isCurrent = v.id === finalMeta?.currentVersion ? ' 👈 当前' : ''
      console.log(`   ${idx + 1}. ${v.id}${isCurrent}`)
      console.log(`      Prompt: ${v.prompt}`)
      console.log(`      Valid: ${v.isValid}`)
    })

    console.log('\n9️⃣ 测试版本切换...')
    await fileManager.checkoutVersion(version2Id)
    const switchedMeta = await fileManager.getMeta()
    console.log(`   ✅ 切换后当前版本: ${switchedMeta?.currentVersion}`)

    const code2 = await fileManager.readVersionCode(version2Id)
    console.log(`   📄 版本代码长度: ${code2?.length}`)

    console.log('\n✨ 所有测试通过!')
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

await testAutoVersioning()
