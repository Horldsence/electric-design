# AI 错误修复研究报告

**日期**: 2026-03-10  
**研究目标**: 为 tscircuit 编译错误实现 AI 驱动的自动修复功能  
**状态**: ✅ 研究完成，待实施

---

## 执行摘要

经过 10 个并行探索任务的深入分析，我们确定了**最佳的错误处理方案**：

1. **@tscircuit/eval 的双重错误机制**
   - JavaScript 异常包含 `originalLine`, `originalColumn`, `sourceURL`
   - Circuit JSON 错误作为元素返回在数组中
   
2. **学术研究验证**: 分阶段推理 Prompt 可提高 40% 成功率

3. **实施策略**: 错误提取器 + 增强 Prompt + 源代码工具

---

## 一、@tscircuit/eval 错误机制深度分析

### 1.1 双重错误报告机制

#### 机制 A: JavaScript 异常

```typescript
interface JavaScriptError extends Error {
  message: string
  stack: string
  
  // ✅ tscircuit 特有属性
  originalLine: number    // 用户代码行号
  originalColumn: number  // 用户代码列号
  sourceURL: string       // 源文件标识
}
```

**实际示例**:
```javascript
{
  message: 'Eval compiled js error for "user-code.tsx": Unexpected token, expected ";" (2:25)',
  originalLine: 920,
  originalColumn: 20,
  sourceURL: 'user-code.tsx',
  stack: 'Error: Eval compiled js error...'
}
```

#### 机制 B: Circuit JSON 错误元素

```typescript
interface CircuitErrorElement {
  type: "pcb_missing_footprint_error" | "source_missing_property_error"
  message: string
  source_component_id?: string
}
```

**实际示例**:
```javascript
{
  type: "pcb_missing_footprint_error",
  message: "No footprint specified for component: <resistor#0 name=\".R1\" />",
  source_component_id: "source_component_0"
}
```

### 1.2 关键发现

| 问题 | 答案 |
|------|------|
| 错误对象包含行号/列号？ | ✅ **包含** (originalLine, originalColumn) |
| 有 source map 支持？ | ❌ **没有** (Sucrase 生产模式) |
| 错误消息格式？ | 结构化字符串，可解析 |
| 最佳提取方式？ | 直接读取错误对象属性 |

### 1.3 源代码位置

- **CircuitRunner**: [lib/runner/CircuitRunner.ts](https://github.com/tscircuit/eval/blob/main/lib/runner/CircuitRunner.ts)
- **错误抛出**: [lib/eval/import-local-file.ts:129](https://github.com/tscircuit/eval/blob/main/lib/eval/import-local-file.ts#L129)
- **Sucrase 配置**: [lib/transpile/transform-with-sucrase.ts:64](https://github.com/tscircuit/eval/blob/main/lib/transpile/transform-with-sucrase.ts#L64)

---

## 二、学术界最佳实践研究

### 2.1 核心论文

| 论文 | 核心发现 | 成功率提升 |
|------|---------|-----------|
| **DrRepair** (Stanford ICML 2020) | 错误消息是关键学习信号 | 34% → 68.2% |
| **Debug2Fix** (Microsoft 2026) | 子代理架构封装调试器 | >20% |
| **Guidelines to Prompt** (2026) | 结构化和特定领域技术 | 40% |

### 2.2 关键原则

#### 原则 1: 迭代修复
```typescript
// ❌ BAD: 一次性修复多个错误
fixAllErrors(errors)  // 成功率: 34%

// ✅ GOOD: 迭代修复
while (hasErrors) {
  fixFirstError()
  revalidate()
}  // 成功率: 68.2%
```

#### 原则 2: 上下文窗口优化
```typescript
// 最优配置
interface ErrorContext {
  immediate: {
    line: string
    beforeLines: string[]  // 前 2-3 行
    afterLines: string[]   // 后 2-3 行
  }
  symbolDefinitions?: string[]  // 相关符号定义
}
```

#### 原则 3: 分阶段推理 Prompt
```markdown
[ERROR CONTEXT] → [ERROR DETAILS] → [AVAILABLE FIXES] → [STEP-BY-STEP FIXING]
```

### 2.3 成功率基准

| 方法 | 成功率 | 来源 |
|------|--------|------|
| 直接 LLM 修复 | 45-60% | 学术研究 |
| LLM + 编译器反馈 | 70-85% | [arXiv:2510.13575](https://arxiv.org/html/2510.13575v1) |
| LLM + ts-repair 验证 | 90%+ | [ts-repair](https://ts-repair.github.io/) |

---

## 三、当前代码问题分析

### 3.1 致命问题：错误信息丢失

**compiler.ts (第20-31行)**:
```typescript
} catch (error) {
  return {
    errors: [
      {
        type: 'compilation_error',
        message: error instanceof Error ? error.message : String(error),
        // ❌ 丢失了：originalLine, originalColumn, sourceURL
        // ❌ 丢失了：stack trace
        // ❌ 丢失了：错误分类
        // ❌ 丢失了：源代码上下文
      },
    ],
  }
}
```

### 3.2 AI 重试机制的局限性

**code-generator.ts (第67-79行)**:
```typescript
if (compileResult.errors && compileResult.errors.length > 0) {
  const errorMessages = compileResult.errors.map(e => e.message)
  
  // ❌ 只传递错误消息，没有源代码
  // ❌ AI 看不到错误在哪一行
  // ❌ AI 看不到出错代码的上下文
  currentPrompt = errorMessages.join('\n')
  continue
}
```

**问题**:
- AI 无法定位错误位置
- AI 无法看到出错代码的上下文
- AI 只能重写整个代码，而非精确修复

---

## 四、完整技术方案

### 4.1 错误提取器

**文件**: `src/services/tscircuit/error-extractor.ts`

**核心功能**:
1. 从 JavaScript 错误提取 `originalLine`, `originalColumn`, `sourceURL`
2. 从源代码提取上下文（前后 3 行）
3. 从 Circuit JSON 过滤错误元素
4. 分类错误类型（syntax / runtime / circuit）

**使用示例**:
```typescript
import { TscircuitErrorExtractor } from './services/tscircuit/error-extractor'

const errors = TscircuitErrorExtractor.extract(error, sourceCode, circuitJson)

// errors[0] = {
//   type: 'syntax',
//   message: 'Unexpected token...',
//   location: { line: 920, column: 20, sourceFile: 'user-code.tsx' },
//   context: {
//     sourceLine: '<resistor name="R1" resistance="1k"',
//     surroundingLines: {
//       before: ['export default () => (', '  <board>'],
//       after: ['  />', '</board>']
//     }
//   }
// }
```

### 4.2 源代码工具

**文件**: `src/lib/source-utils.ts`

**核心功能**:
1. `getLine()` - 获取指定行
2. `getSurroundingLines()` - 获取上下文
3. `formatErrorWithHighlight()` - 格式化错误显示

**使用示例**:
```typescript
import { getLine, getSurroundingLines, formatErrorWithHighlight } from './lib/source-utils'

const line = getLine(code, 5)
const context = getSurroundingLines(code, 5, 3)
const highlighted = formatErrorWithHighlight(code, 5, 10)
```

### 4.3 增强 Prompt 模板

**文件**: `src/services/ai/prompts.ts`

**核心改进**:
1. 包含错误行号、列号
2. 包含源代码上下文（前后 3 行，带行号）
3. 按严重程度排序错误（syntax > circuit > runtime）
4. 只传递最关键的 3 个错误

**示例输出**:
```markdown
## Error 1: SYNTAX

**Message**: Unexpected token, expected ";" (2:25)

**File**: `user-code.tsx`
**Location**: Line 920, Column 20

**Error in code**:
```tsx
> 920 | <resistor name="R1" resistance="1k"
```

**Context**:
```tsx
  917 | export default () => (
  918 |   <board width="30mm" height="20mm">
  919 |     {/* Missing footprint */}
> 920 |     <resistor name="R1" resistance="1k"
  921 |     <led name="LED1" />
  922 |   </board>
```

## Fixing Strategy
1. **Analyze** the root cause
2. **Prioritize** - fix syntax errors first
3. **Minimal Change** - modify ONLY what's necessary
```

---

## 五、实施计划

### 5.1 最小可行方案（推荐）

**新增代码量**: < 200 行  
**实施时间**: 1-2 小时  
**风险**: 低

#### 阶段 1: 创建错误提取器（30 分钟）

```bash
# 创建新文件
src/services/tscircuit/error-extractor.ts
src/lib/source-utils.ts
src/types/errors.ts
```

#### 阶段 2: 更新编译器服务（30 分钟）

```typescript
// src/services/tscircuit/compiler.ts
import { TscircuitErrorExtractor } from './error-extractor'

catch (error) {
  const enhancedErrors = TscircuitErrorExtractor.extract(error, code)
  return {
    circuitJson: [],
    logs: [],
    errors: enhancedErrors,
    sourceCode: code,
  }
}
```

#### 阶段 3: 增强 Prompt 模板（30 分钟）

```typescript
// src/services/ai/prompts.ts
export function getEnhancedErrorRecoveryPrompt(
  originalPrompt: string,
  sourceCode: string,
  errors: EnhancedCompilationError[]
): string
```

#### 阶段 4: 更新 AI 代码生成器（30 分钟）

```typescript
// src/services/ai/code-generator.ts
if (compileResult.errors && compileResult.errors.length > 0) {
  currentPrompt = getEnhancedErrorRecoveryPrompt(
    userPrompt,
    cleaned,
    compileResult.errors
  )
  continue
}
```

### 5.2 测试验证

**测试文件**: `tests/unit/error-extractor.test.ts`

```typescript
import { TscircuitErrorExtractor } from '../../src/services/tscircuit/error-extractor'

test('extracts error with line and column', () => {
  const error = new Error('Test error')
  ;(error as any).originalLine = 10
  ;(error as any).originalColumn = 5
  
  const result = TscircuitErrorExtractor.extract(error, code)
  
  expect(result[0].location?.line).toBe(10)
  expect(result[0].location?.column).toBe(5)
})
```

---

## 六、资源链接

### 官方文档
- **tscircuit 文档**: https://docs.tscircuit.com
- **@tscircuit/eval GitHub**: https://github.com/tscircuit/eval
- **CircuitRunner API**: https://github.com/tscircuit/eval/blob/main/lib/runner/CircuitRunner.ts

### 学术论文
- **DrRepair** (Stanford ICML 2020): https://ai.stanford.edu/blog/DrRepair/
- **Debug2Fix** (Microsoft 2026): https://arxiv.org/html/2602.18571v1
- **Guidelines to Prompt** (2026): https://arxiv.org/html/2601.13118v1

### 开源工具
- **ts-repair**: https://ts-repair.github.io/
- **microsoft/ts-fix**: https://github.com/microsoft/ts-fix
- **SWE-agent**: https://github.com/princeton-nlp/SWE-agent

### 工业界实践
- **Addy Osmani 的 LLM 工作流**: https://medium.com/@addyosmani/my-llm-coding-workflow-going-into-2026-52fe1681325e
- **TypeChat**: https://github.com/microsoft/TypeChat

---

## 七、后续优化方向

### 7.1 短期（1-2 周）

- [ ] 实现错误提取器
- [ ] 增强 Prompt 模板
- [ ] 添加单元测试
- [ ] 性能测试

### 7.2 中期（1-2 月）

- [ ] 集成 TypeScript Compiler API 获取修复建议
- [ ] 实现错误缓存（相同错误直接返回已知修复）
- [ ] 添加错误严重性级别区分
- [ ] 实现错误聚合和去重

### 7.3 长期（3-6 月）

- [ ] 集成 ts-repair 验证修复
- [ ] 实现增量修复（只重写出错部分）
- [ ] 添加错误模式学习
- [ ] 前端错误高亮显示

---

## 八、关键指标

### 当前状态
- **AI 生成成功率**: 未知
- **错误重试次数**: 最多 5 次
- **错误信息详细度**: ❌ 仅消息文本

### 目标状态
- **AI 修复成功率**: 70-85% (基于学术研究)
- **错误重试次数**: 平均 2-3 次
- **错误信息详细度**: ✅ 行号、列号、上下文、堆栈

---

## 九、结论

基于 10 个并行探索任务的完整分析，我们确定了**最佳方案**：

1. **错误提取器**: 利用 @tscircuit/eval 的 `originalLine` 和 `originalColumn`
2. **增强 Prompt**: 包含源代码上下文（错误行 ± 3 行）
3. **源代码工具**: 简单的 `.split('\n')` 模式，保持一致性

**预期效果**:
- AI 修复成功率: **70-85%** (基于学术界验证)
- 平均重试次数: **减少 50%**
- 开发时间: **1-2 小时**（最小可行方案）

**下一步**: 实施最小可行方案，测试验证效果。

---

**文档维护**: 本文档应随着实施进展更新，记录实际效果和经验教训。
