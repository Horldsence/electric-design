# CI/CD 配置说明

本项目已配置完整的自动化CI/CD流程，确保代码质量和稳定性。

## GitHub Actions CI

### 触发条件
- 推送到 `main` 分支
- 创建针对 `main` 分支的 Pull Request

### CI 工作流程

CI 包含四个并行运行的作业：

1. **Type Check** - TypeScript 类型检查
   - 确保类型安全
   - 检测类型错误

2. **Lint** - 代码质量检查
   - Biome：JavaScript/TypeScript 代码检查
   - Stylelint：CSS 样式检查

3. **Test** - 运行测试套件
   - 执行所有集成测试
   - 使用 Bun 内置测试框架

4. **Build** - 构建验证
   - 验证项目可以成功构建
   - 上传构建产物（保留7天）

## 本地开发命令

### 代码质量检查

```bash
# 类型检查
bun run type-check

# Lint检查
bun run lint

# 自动修复lint问题
bun run lint:fix

# 代码格式化
bun run format

# 检查代码格式（不修改）
bun run format:check
```

### 测试

```bash
# 运行所有测试
bun test

# 监听模式运行测试
bun run test:watch

# 运行测试并生成覆盖率报告
bun run test:coverage
```

### 构建和运行

```bash
# 开发模式（热重载）
bun run dev

# 生产构建
bun run build

# 生产环境运行
bun run start
```

## Pre-commit 钩子

可选：安装 pre-commit 钩子在提交前自动运行检查：

```bash
# 安装 pre-commit（如果未安装）
brew install pre-commit

# 安装钩子
pre-commit install

# 手动运行所有检查
pre-commit run --all-files
```

## 代码质量工具

### Biome
- **作用**：快速、现代化的JavaScript/TypeScript linter和formatter
- **配置文件**：`biome.json`
- **特点**：
  - 比 ESLint/Prettier 快 10-100 倍
  - 集成了 linting、formatting 和 import sorting
  - 内置支持 JSX 和 TypeScript

### Stylelint
- **作用**：CSS 代码质量检查
- **配置文件**：`.stylelintrc.json`
- **特点**：
  - 确保一致的 CSS 代码风格
  - 检测 CSS 错误和潜在问题

### TypeScript
- **作用**：静态类型检查
- **配置文件**：`tsconfig.json`
- **特点**：
  - 严格的类型检查模式
  - 启用所有推荐的类型检查选项

## CI 性能优化

- 使用 Bun 缓存加速依赖安装
- 并行运行独立的作业（type-check, lint, test）
- Build 作业依赖于其他作业的成功完成
- 缓存 node_modules 以加快 CI 速度

## 状态徽章

你可以在 README.md 中添加 CI 状态徽章：

```markdown
![CI](https://github.com/YOUR_USERNAME/electric-design/workflows/CI/badge.svg)
```

## 故障排查

### TypeScript 类型错误
```bash
# 查看详细类型错误
bun run type-check
```

### Lint 错误
```bash
# 自动修复大部分 lint 问题
bun run lint:fix
```

### 测试失败
```bash
# 运行特定测试文件
bun test tests/integration/pipeline.test.ts

# 监听模式便于调试
bun run test:watch
```

## 最佳实践

1. **提交前运行检查**
   ```bash
   bun run type-check && bun run lint && bun test
   ```

2. **推送前确保构建成功**
   ```bash
   bun run build
   ```

3. **遵循代码风格**
   - 使用 `bun run format` 格式化代码
   - 遵循 Biome 的代码规则

4. **保持测试覆盖率**
   - 为新功能编写测试
   - 确保所有测试通过后再提交

## 相关文档

- [Bun 文档](https://bun.sh/docs)
- [Biome 文档](https://biomejs.dev/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
