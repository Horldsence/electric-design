# Electric Design - AI驱动的电路设计自动化系统

## 项目概述

将自然语言需求转换为KiCad工程文件的完整自动化流水线：
```
用户输入 (自然语言) → AI生成 (tscircuit代码) → 编译 (Circuit JSON) → 转换 (KiCad文件)
```

**实际状态**: 核心服务层已实现 (ai/, tscircuit/, kicad/, pipeline/)，前端组件为空壳。完整路径见 `src/services/AGENTS.md` 和 `src/routes/AGENTS.md`。

## 核心哲学

### Linus式设计原则
1. **数据结构优先** - 数据流就是：`string → string → JSON → files`
2. **消除特殊情况** - 统一错误处理，不要每个阶段都try-catch
3. **最简实现** - 每个转换一个函数，清楚直接
4. **零破坏性** - 新项目，无向后兼容包袱

### 好品味准则
- 如果函数超过3层缩进，重新设计
- 如果需要复杂的条件判断，数据结构可能错了
- 复杂性是万恶之源

## 日志和调试

### 设计哲学
日志是数据流的一部分，不是额外的负担。按照Linus哲学：
- **数据结构优先**：日志就是结构化JSON对象
- **消除特殊情况**：统一的logger到处用
- **最简实现**：一个Logger类，包装Bun.log
- **零破坏性**：添加日志不影响现有逻辑

### 日志架构

```typescript
// 核心Logger (src/lib/logger.ts)
type LogEntry = {
  level: "debug" | "info" | "warn" | "error"
  timestamp: number
  context: string
  message: string
  data?: unknown
  error?: Error
  duration?: number
}

// 使用示例
import { logger } from "./lib/logger"

logger.info("ai-generation", "Code generated", {
  attempt: 1,
  codeLength: 1234
})

logger.error("compilation", error, {
  sessionId: "session_123"
})

// 性能测量
await logger.measure("context", "operation-name", async () => {
  // do work
})
```

### Pipeline专用Logger

```typescript
// src/lib/debug.ts
import { createPipelineLogger } from "./lib/debug"

// 创建pipeline logger
const log = createPipelineLogger("pipeline", sessionId)

// 阶段日志
const compileStage = log.stage("compile")
compileStage.info("Starting compilation")
compileStage.error("Compilation failed", error)

// 自动计时
await compileStage.measure("compile-circuit", async () => {
  // do compilation
})
```

### 日志级别控制

环境变量控制日志级别：
```bash
# 开发环境：详细日志
LOG_LEVEL=debug bun dev

# 生产环境：只记录错误和警告
LOG_LEVEL=warn bun start
```

### 日志格式

**开发环境**（彩色、可读）：
```
[INFO] pipeline:compile | Compilation started { codeLength: 1234 }
[WARN] ai-generation | No API key found, using fallback
[ERROR] tscircuit:compile | Compilation failed [Error: Invalid syntax]
```

**生产环境**（JSON、机器可读）：
```json
{"level":"info","time":1234567890,"ctx":"pipeline:compile","msg":"Compilation started","data":{"codeLength":1234}}
{"level":"error","time":1234567891,"ctx":"tscircuit:compile","msg":"Compilation failed","err":{"name":"Error","message":"Invalid syntax"}}
```

### 调试最佳实践

**DO ✅**:
- 每个pipeline阶段开始/结束时记录
- 记录关键数据（长度、计数、耗时）
- 使用`measure()`跟踪性能瓶颈
- 在catch块中记录错误和上下文

**DON'T ❌**:
- 不要在每个函数都加日志（太吵）
- 不要记录敏感数据（API密钥、用户输入）
- 不要用console.log（用logger）
- 不要在循环中记录大量数据

### 性能监控

自动跟踪每个阶段的耗时：
```typescript
const result = await log.measure("stage", "heavy-operation", async () => {
  // 这段代码的耗时会被自动记录
  return await expensiveOperation()
})
// 输出: [DEBUG] stage | Finished: heavy-operation (123ms)
```

### 最佳实践（基于生产系统研究）

**DO ✅**:
- 使用`Bun.write()`进行文件日志（原生、快速、简单）
- 使用`Bun.stderr`输出错误（正确的stream）
- 实现级别过滤（简单比较）
- 结构化日志为JSON（机器可读）
- 单一Logger类（一个目的，清晰接口）
- 使用`performance.now()`进行性能测量
- 自定义Error类使用`Error.captureStackTrace`

**DON'T ❌**:
- 不用winston/pino（过度工程）
- 不创建抽象层次（YAGNI）
- 不实现自定义格式化器（JSON.stringify足够）
- 不添加transports/formatters（数据结构优先）

**性能**: Bun的native I/O比Node.js快3-4倍用于日志操作，所以适度负载不需要复杂缓冲。

### 调试模式

开发时使用DEBUG环境变量：
```bash
# 启用所有debug日志
DEBUG=* bun dev

# 启用特定pipeline
DEBUG=pipeline:* bun dev

# 启用特定阶段
DEBUG=pipeline:compile bun dev
```

### 错误处理

全局错误处理器（捕获未处理的异常）：
```typescript
process.on('uncaughtException', (error: Error) => {
  logger.error('uncaught', 'UNCAUGHT EXCEPTION', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('unhandled', 'UNHANDLED REJECTION', reason)
})
```

## 技术栈

### 核心层
| 层级 | 技术 | 用途 |
|------|------|------|
| 运行时 | Bun 1.3.5 | 一体化runtime, bundler, test runner |
| 前端 | React 19 | UI界面 |
| 后端 | Bun.serve() | 内置HTTP服务器 |

### 功能层
| 模块 | 库 | 用途 |
|------|------|------|
| **AI生成** | `openai` 或 `@anthropic-ai/sdk` | LLM代码生成 |
| **tscircuit编译** | `@tscircuit/eval` | 动态代码执行 |
| **tscircuit核心** | `@tscircuit/core` | 静态电路组件 |
| **Circuit JSON** | `circuit-json` | 类型定义 |
| **Circuit JSON工具** | `@tscircuit/circuit-json-util` | 查询和操作 |
| **验证** | `@tscircuit/checks` | 设计规则检查 |
| **KiCad转换** | `circuit-json-to-kicad` | Circuit JSON → KiCad |
| **KiCad解析** | `kicad-converter` | KiCad → Circuit JSON |
| **KiCad CLI** | 系统命令 | ERC/DRC验证 |
| **KiBot** | 系统命令 | Gerber/BOM生成 |
| **验证** | `zod` | Schema验证 |

## 数据流架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          数据流（单向）                           │
└─────────────────────────────────────────────────────────────────┘

  用户输入
      │
      ▼
  ┌─────────────┐
  │ AI服务层    │  prompt工程 → tscircuit代码 (TSX string)
  └─────────────┘
      │
      ▼
  ┌─────────────┐
  │ 编译服务层  │  @tscircuit/val → Circuit JSON (AnyCircuitElement[])
  └─────────────┘
      │
      ▼
  ┌─────────────┐
  │ 验证服务层  │  @tscircuit/checks → 设计规则检查
  └─────────────┘
      │
      ▼
  ┌─────────────┐
  │ 转换服务层  │  circuit-json-to-kicad → KiCad文件 (.kicad_sch, .kicad_pcb)
  └─────────────┘
      │
      ▼
  ┌─────────────┐
  │ 后处理层    │  KiCad CLI + KiBot → ERC/DRC + Gerber/BOM
  └─────────────┘
      │
      ▼
    输出文件
```

## 目录结构

```
electric-design/
├── src/
│   ├── index.ts                    # Bun服务器入口
│   ├── frontend.tsx                # React应用入口
│   │
│   ├── types/                      # 类型定义
│   │   ├── tscircuit.ts            # Circuit JSON类型
│   │   ├── kicad.ts                # KiCad文件类型
│   │   └── pipeline.ts             # Pipeline数据类型
│   │
│   ├── services/                   # 核心业务逻辑（数据转换）
│   │   ├── ai/
│   │   │   ├── code-generator.ts   # LLM → tscircuit代码
│   │   │   └── prompts.ts          # Prompt模板
│   │   │
│   │   ├── tscircuit/
│   │   │   ├── compiler.ts         # TSX → Circuit JSON
│   │   │   └── validator.ts        # @tscircuit/checks包装
│   │   │
│   │   ├── kicad/
│   │   │   ├── converter.ts        # Circuit JSON → KiCad
│   │   │   └── validator.ts        # KiCad CLI + KiBot
│   │   │
│   │   └── pipeline/
│   │       ├── orchestrator.ts     # 主编排器（4个步骤的协调）
│   │       └── error-handler.ts    # 统一错误处理
│   │
│   ├── routes/                     # API路由（薄包装）
│   │   ├── generate.ts             # POST /api/generate
│   │   ├── compile.ts              # POST /api/compile
│   │   ├── convert.ts              # POST /api/convert
│   │   └── export.ts               # POST /api/export (完整pipeline)
│   │
│   ├── lib/                        # 工具库
│   │   ├── logger.ts               # 结构化日志
│   │   ├── file-manager.ts         # 文件I/O
│   │   └── config.ts               # 环境配置
│   │
│   └── web/                        # 前端组件
│       ├── App.tsx
│       ├── components/
│       │   ├── InputPanel.tsx
│       │   ├── CodeViewer.tsx
│       │   └── ResultViewer.tsx
│       └── api/
│           └── client.ts
│
├── tests/                          # bun test
│   ├── unit/                       # 单元测试
│   ├── integration/                # 集成测试
│   └── e2e/                        # 端到端测试
│
└── package.json
```

## 核心模块设计

### 1. AI服务层 (`services/ai/code-generator.ts`)

**职责**: 将自然语言转换为tscircuit代码

**输入**: `userPrompt: string`
**输出**: `tscircuitCode: string`

**关键点**:
- Prompt工程：引导LLM生成符合规范的代码
- 重试机制：AI生成不稳定，最多3次
- 降级策略：失败时返回示例代码

### 2. tscircuit编译层 (`services/tscircuit/compiler.ts`)

**职责**: 将TSX代码编译为Circuit JSON

**输入**: `code: string`
**输出**: `circuitJson: AnyCircuitElement[]`

**关键点**:
- 使用 `@tscircuit/eval` 的 `CircuitRunner`
- 缓存runner实例（性能优化）
- 错误处理：捕获编译错误并提取日志

### 3. 验证服务层 (`services/tscircuit/validator.ts`)

**职责**: 设计规则检查

**输入**: `circuitJson: AnyCircuitElement[]`
**输出**: `{ isValid: boolean; errors: ValidationError[] }`

**关键点**:
- 使用 `@tscircuit/checks`
- 返回详细错误信息（类型、消息、元素ID）

### 4. KiCad转换层 (`services/kicad/converter.ts`)

**职责**: Circuit JSON转换为KiCad文件

**输入**: `circuitJson: AnyCircuitElement[]`
**输出**: `{ pcb: string; sch: string }`

**关键点**:
- 使用 `circuit-json-to-kicad` 官方库
- 生成.sch和.pcb文件
- 同步调用 `runUntilFinished()`

### 5. Pipeline编排器 (`services/pipeline/orchestrator.ts`)

**职责**: 协调所有层，处理重试和降级

**完整流程**:
```typescript
async function orchestrator(userPrompt: string): Promise<PipelineResult> {
  // 步骤1: AI生成代码（带重试）
  const code = await generateCode(userPrompt)

  // 步骤2: 编译为Circuit JSON
  const circuitJson = await compileCircuit(code)

  // 步骤3: 验证
  const validation = await validateCircuit(circuitJson)
  if (!validation.isValid) {
    throw new ValidationError(validation.errors)
  }

  // 步骤4: 转换为KiCad
  const kicadFiles = await convertToKiCad(circuitJson)

  // 步骤5: 后处理（可选）
  const postProcessed = await postProcess(kicadFiles)

  return { circuitJson, kicadFiles: postProcessed }
}
```

## API设计

### POST /api/export

完整pipeline：从自然语言到KiCad文件

**请求**:
```json
{
  "prompt": "Create a blinking LED circuit with a 555 timer",
  "options": {
    "includeGerber": true,
    "runDrc": true
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "circuitJson": [...],
    "kicadFiles": {
      "pcb": "...",
      "sch": "..."
    },
    "artifacts": {
      "gerber": "base64...",
      "bom": [...]
    },
    "validation": {
      "isValid": true,
      "errors": []
    }
  }
}
```

### POST /api/compile

单独的编译步骤：tscircuit代码 → Circuit JSON

### POST /api/convert

单独的转换步骤：Circuit JSON → KiCad文件

## 错误处理策略

### 分层错误类型

```typescript
class AIGenerationError extends Error {
  constructor(message: string, public retryCount: number) {
    super(message)
    this.name = "AIGenerationError"
  }
}

class CompilationError extends Error {
  constructor(
    message: string,
    public code: string,
    public logs?: unknown[]
  ) {
    super(message)
    this.name = "CompilationError"
  }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{type: string; message: string}>
  ) {
    super(message)
    this.name = "ValidationError"
  }
}

class ConversionError extends Error {
  constructor(message: string, public stage: string) {
    super(message)
    this.name = "ConversionError"
  }
}
```

### 统一错误处理

```typescript
// services/pipeline/error-handler.ts
export function handlePipelineError(error: Error): ApiResponse {
  if (error instanceof AIGenerationError) {
    return {
      success: false,
      error: {
        type: "ai_generation_failed",
        message: "Failed to generate circuit code",
        details: error.message,
        retryAvailable: error.retryCount < 3
      }
    }
  }

  if (error instanceof CompilationError) {
    return {
      success: false,
      error: {
        type: "compilation_failed",
        message: "Circuit code compilation failed",
        details: error.message,
        logs: error.logs
      }
    }
  }

  // ... 其他错误类型

  return {
    success: false,
    error: {
      type: "unknown_error",
      message: "An unexpected error occurred"
    }
  }
}
```

## 依赖安装

```bash
# 核心依赖
bun add @tscircuit/eval @tscircuit/core circuit-json
bun add @tscircuit/circuit-json-util @tscircuit/checks
bun add circuit-json-to-kicad kicad-converter

# AI SDK（选择一个）
bun add openai
# 或
bun add @anthropic-ai/sdk

# 验证
bun add zod

# 开发依赖
bun add -d @types/node
```

## 测试策略

### 单元测试
```typescript
// tests/unit/compiler.test.ts
import { test, expect } from "bun:test"
import { compileCircuit } from "../../src/services/tscircuit/compiler"

test("compiles simple resistor circuit", async () => {
  const code = `
    export default () => (
      <resistor name="R1" resistance="1k" />
    )
  `

  const result = await compileCircuit(code)

  expect(result.circuitJson).toHaveLength(1)
  expect(result.circuitJson[0].name).toBe("R1")
})
```

### 集成测试
```typescript
// tests/integration/pipeline.test.ts
test("full pipeline: prompt → KiCad files", async () => {
  const result = await runPipeline("Create a simple LED circuit")

  expect(result.success).toBe(true)
  expect(result.data.kicadFiles.pcb).toContain("(kicad_pcb")
  expect(result.data.kicadFiles.sch).toContain("(kicad_sch")
})
```

## 性能优化

1. **CircuitRunner缓存**: 复用runner实例
2. **并发限制**: 限制同时编译的数量
3. **结果缓存**: 相同输入直接返回缓存
4. **流式输出**: 大文件分块传输

## 安全考虑

1. **沙箱执行**: AI生成的代码在隔离环境中运行
2. **资源限制**: 限制编译时间和内存
3. **输入验证**: Zod schema验证所有输入
4. **API密钥管理**: 环境变量存储密钥

## 部署建议

1. **KiCad CLI**: 需要系统安装KiCad（用于ERC/DRC）
2. **环境变量**:
   - `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY`
   - `KICAD_PATH` (可选，默认系统路径)
3. **资源要求**:
   - 最小: 1CPU, 2GB RAM
   - 推荐: 2CPU, 4GB RAM

## 开发指南

### 添加新的转换器

1. 在 `services/` 下创建新目录
2. 实现 `convert(input: TInput): Promise<TOutput>` 函数
3. 在 `orchestrator.ts` 中添加步骤
4. 编写测试

### 修改Prompt模板

编辑 `services/ai/prompts.ts`，包含：
- 代码示例
- 类型要求
- 约束条件
- 错误处理指导

## 贡献指南

1. 遵循现有代码风格
2. 添加测试覆盖
3. 更新文档
4. 通过 `bun test` 验证
5. 运行 `bun run lint` 检查

## 许可证

MIT

---

## 项目状态 (2025-03-06)

### 已实现 ✅
- 核心服务层 (src/services/) - AI生成、tscircuit编译、验证、KiCad转换
- Pipeline编排器 - 完整流程协调与错误处理
- API路由 (src/routes/) - 4个端点 (export, compile, convert, compile-and-convert)
- 日志系统 (src/lib/logger.ts, src/lib/debug.ts) - 结构化日志与性能测量
- 集成测试 (tests/integration/) - 端到端pipeline测试

### 缺失功能 ❌
- 前端组件 (src/web/components/) - InputPanel, CodeViewer, ResultViewer 未实现
- API客户端 (src/web/api/client.ts) - 前端API通信层
- generate.ts 路由 - AI代码生成独立端点
- 工具库 (src/lib/) - file-manager.ts, config.ts 缺失
- 单元测试 (tests/unit/) 和 E2E测试 (tests/e2e/)

### 架构偏差 ⚠️
- React组件在 src/ 根目录而非 src/web/
- 类型结构变化: ai.ts 替代了 pipeline.ts
- 合并端点 compile-and-convert.ts 打破单一职责模式

### 代码质量问题 🔧
- DRY违规: kicad/validator.ts 中 ~120行 exec() 模式重复
- DRY违规: API响应对象在4+路由中重复
- 错误处理不一致: 自定义错误类已定义但服务返回错误对象而非抛出

**行动优先级**:
1. 实现 src/web/components/ 核心组件
2. 提取 kicad/validator.ts 中重复的 exec() 模式
3. 统一错误处理策略 (throw vs return)
4. 决定: 保留 compile-and-convert.ts 或拆分为单一职责端点
