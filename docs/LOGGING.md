# 日志和调试系统

## 核心设计

遵循Linus哲学：**数据结构优先，消除特殊情况，最简实现**

### 架构

```
数据流: {level, time, context, msg, data} → console/Bun.log

核心类:
- Logger: 统一的日志接口
- createPipelineLogger(): Pipeline专用logger
- debugContext(): 通用debug上下文
```

## 使用方法

### 基础日志

```typescript
import { logger } from "./lib/logger"

logger.info("context", "message", { data: "value" })
logger.warn("context", "warning message")
logger.error("context", error)  // 自动提取Error对象
logger.debug("context", "debug info", { details: "..." })
```

### Pipeline日志

```typescript
import { createPipelineLogger } from "./lib/debug"

const log = createPipelineLogger("pipeline-name", "session-id")

// 创建阶段logger
const stage = log.stage("stage-name")
stage.info("Stage started")

// 自动性能测量
await stage.measure("operation", async () => {
  // do work
})
```

### 日志级别

环境变量控制：
```bash
LOG_LEVEL=debug  # 开发环境
LOG_LEVEL=info   # 默认
LOG_LEVEL=warn   # 生产环境
LOG_LEVEL=error  # 只记录错误
```

## 日志格式

**开发** (彩色):
```
[INFO] pipeline:compile | Compilation started { codeLength: 1234 }
[ERROR] ai-generation | LLM call failed [Error: rate limit]
```

**生产** (JSON):
```json
{"level":"info","time":1234567890,"ctx":"pipeline:compile","msg":"started","data":{"codeLength":1234}}
```

## 最佳实践

✅ DO:
- 在pipeline阶段开始/结束时记录
- 记录关键指标（长度、计数、耗时）
- 使用`measure()`自动计时
- catch块中记录错误和上下文

❌ DON'T:
- 不要每个函数都加日志
- 不要记录敏感数据
- 不要用console.log
- 不要在循环中记录大量数据
