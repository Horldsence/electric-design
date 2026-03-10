# Electric Design

<p align="center">
  <strong>一个基于 Bun、React、tscircuit 与 KiCad 工作流的开源电路设计自动化项目。</strong>
</p>

<p align="center">
  Electric Design 将生成、编译、转换、校验、导出与下载整合为统一的 Web 化工具链。
</p>

<p align="center">
  <a href="./README.md">English</a> | <strong>简体中文</strong>
</p>

<p align="center">
  <img alt="Bun" src="https://img.shields.io/badge/runtime-Bun-black">
  <img alt="React" src="https://img.shields.io/badge/frontend-React%2019-61dafb">
  <img alt="TypeScript" src="https://img.shields.io/badge/language-TypeScript-3178c6">
  <img alt="KiCad" src="https://img.shields.io/badge/integration-KiCad-314cb6">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-green">
  <img alt="Status" src="https://img.shields.io/badge/status-active%20development-orange">
</p>

---

## 目录

- [项目简介](#项目简介)
- [界面示例](#界面示例)
- [功能特性](#功能特性)
- [今日更新](#今日更新)
- [架构概览](#架构概览)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [可用脚本](#可用脚本)
- [API 概览](#api-概览)
- [开发说明](#开发说明)
- [文档索引](#文档索引)
- [路线图](#路线图)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

---

## 项目简介

Electric Design 是一个面向电路设计自动化的开源项目，构建于 `Bun`、`React`、`tscircuit` 生态以及 KiCad 相关工具链之上。

它的目标是支持这样一条端到端流程：

`输入 → 生成 → 编译 → 转换 → 校验 → 导出 → 下载`

当前仓库已经具备以下基础能力：

- 可运行的后端服务结构
- 控制台风格的前端界面
- 面向 KiCad 的校验与导出流程
- 围绕核心处理链路的测试与调试脚本

### 项目目标

- 将用户输入转换为可执行的电路描述
- 将电路定义编译为可处理的中间数据
- 将结果转换为 KiCad 可兼容产物
- 对设计执行规则校验与检查
- 导出 Gerber、BOM 等面向生产的交付文件
- 提供统一的 Web 化工作流入口

---

## 界面示例

### 示例截图

![Electric Design Example](images/example.png)

---

## 功能特性

### 当前已具备的能力

- 基于 Bun 的 HTTP 服务
- React 前端应用
- WebSocket 支持
- 电路生成接口
- 编译与转换接口
- KiCad 校验接口
- Gerber 与 BOM 导出接口
- 文件下载接口
- 面向 KiCad 校验流程的测试覆盖
- 内部日志与 pipeline 调试文档

### 已覆盖的工作流阶段

- 文本或代码输入
- 电路生成
- 电路编译
- KiCad 转换
- ERC / DRC 校验
- Gerber / BOM 导出
- 结果文件下载

---

## 今日更新

基于今天的 Git 提交，项目新增和修复了以下内容：

- 修复了页面相关问题，提升界面稳定性
- 新增工作空间管理能力，支持加载、新建、清除工作空间，并展示工作空间元信息
- 增强错误修复相关流程，加入文件编辑能力以支持更高效的问题处理

这些更新进一步完善了项目从生成、校验到结果保存的工作流体验。

---

## 架构概览

仓库整体按服务化流程组织：

1. **前端 UI** 接收用户输入并展示处理结果
2. **路由层** 提供生成、编译、校验、导出、下载等 HTTP API
3. **服务层** 实现核心业务逻辑
4. **KiCad 相关工具** 用于校验和制造产物输出
5. **测试与调试脚本** 用于验证 CLI 可用性与 pipeline 行为

从高层看，项目遵循以下流程：

- 输入采集
- 电路生成
- 电路编译
- KiCad 转换
- 设计校验
- 导出处理
- 产物下载

---

## 技术栈

### 运行时与平台

- `Bun`
- `TypeScript`
- `React 19`
- `Bun.serve()`

### 电路与转换生态

- `@tscircuit/core`
- `@tscircuit/eval`
- `@tscircuit/checks`
- `circuit-json`
- `circuit-to-svg`
- `circuit-json-to-kicad`
- `kicad-converter`
- `bun-match-svg`

### 工程化工具

- `Biome`
- `Stylelint`
- `bun test`

---

## 项目结构

```text
electric-design/
├── src/
│   ├── components/     # 前端组件
│   ├── examples/       # 示例与样例资源
│   ├── hooks/          # React Hooks
│   ├── lib/            # 配置、日志、工具、底层辅助模块
│   ├── routes/         # Bun HTTP 路由处理层
│   ├── services/       # 生成 / 编译 / 转换 / 校验核心逻辑
│   ├── types/          # 共享类型定义
│   ├── util/           # 通用工具函数
│   ├── web/            # Web 相关资源
│   ├── App.tsx         # 前端主应用组件
│   ├── frontend.tsx    # React 入口
│   ├── index.html      # HTML 入口
│   └── index.ts        # Bun 服务入口
├── tests/
│   ├── unit/           # 单元测试
│   ├── integration/    # 集成测试
│   ├── examples/       # 示例驱动测试
│   └── output/         # 测试输出产物
├── docs/               # 补充文档
├── dist/               # 构建产物
├── images/             # README 图片资源
├── AGENTS.md
├── CLAUDE.md
├── LICENSE
├── package.json
├── bunfig.toml
├── tsconfig.json
├── README.md
└── README.zh-CN.md
```

---

## 快速开始

## 环境要求

建议使用以下环境：

- `Bun 1.3+`
- `KiCad CLI`（用于 ERC / DRC / 导出相关能力）
- macOS 或 Linux

## 安装依赖

```sh
bun install
```

## 启动开发环境

```sh
bun run dev
```

这会以开发模式启动应用，并启用基于 Bun 服务端的热更新能力。

## 构建生产版本

```sh
bun run build
```

构建输出目录为：

- `dist/`

## 启动生产环境

```sh
bun run start
```

## 运行测试

```sh
bun test
```

或者使用项目脚本：

```sh
bun run test
```

---

## 可用脚本

当前 `package.json` 中提供了以下脚本：

- `bun run dev` — 启动开发服务器
- `bun run build` — 构建生产资源
- `bun run start` — 启动生产服务
- `bun run test` — 运行测试
- `bun run test:watch` — 监听模式测试
- `bun run test:coverage` — 测试覆盖率
- `bun run lint` — 执行 TypeScript 与 CSS 检查
- `bun run lint:fix` — 自动修复可处理的 lint 问题
- `bun run format` — 格式化代码
- `bun run format:check` — 检查格式
- `bun run type-check` — 执行 TypeScript 类型检查

### 建议执行的质量检查

```sh
bun run lint
bun run format:check
bun run type-check
```

### 自动修复格式与部分问题

```sh
bun run lint:fix
bun run format
```

---

## API 概览

当前服务端已暴露以下主要接口：

### 基础接口

- `GET /api/hello`
- `PUT /api/hello`
- `GET /api/hello/:name`

### 工作流接口

- `POST /api/generate`
- `POST /api/compile`
- `POST /api/convert`
- `POST /api/compile-and-convert`
- `POST /api/export`

### KiCad 校验与导出接口

- `POST /api/validate-kicad`
- `POST /api/check-kicad`
- `POST /api/export-gerber`
- `POST /api/export-bom`
- `POST /api/auto-fix-validation`

### 下载接口

- `POST /api/download-kicad`
- `POST /api/download-schematic`
- `POST /api/download-gerbers`
- `POST /api/download-bom`

### WebSocket 接口

- `GET /ws`

> 随着接口逐步稳定，后续建议继续补充更完整的请求/响应示例文档。

---

## 开发说明

### 优先使用 Bun

本仓库默认以 Bun 作为核心运行时与工具链，建议优先使用：

- `bun install`
- `bun run <script>`
- `bun test`
- `bunx <package>`

### 依赖 KiCad CLI 的能力

部分流程依赖本地可用的 KiCad CLI。如果校验或导出功能异常，优先检查：

- `kicad-cli` 是否已安装
- 是否已正确加入 `PATH`
- 当前环境是否具备执行权限

### 当前项目成熟度

根据当前仓库结构，可以认为：

- 后端与服务流程相对完整
- 核心 pipeline 已覆盖多个关键阶段
- 前端目前更接近控制台 / 工作台形态，而非最终产品化 UI
- 测试与内部文档对理解项目行为非常重要

---

## 文档索引

仓库内还包含以下补充文档：

- `README.md` — English documentation
- `README.zh-CN.md` — 中文文档
- `AGENTS.md`
- `CLAUDE.md`
- `docs/CI.md`
- `docs/DOWNLOAD_FIX.md`
- `docs/FIX_SUMMARY.md`
- `docs/LOGGING.md`
- `docs/PROMPT_IMPROVEMENT_PLAN.md`
- `docs/架构.md`

如果你是第一次阅读这个仓库，推荐顺序如下：

1. `README.md`
2. `README.zh-CN.md`
3. `AGENTS.md`
4. `docs/架构.md`
5. `docs/LOGGING.md`
6. `tests/kicad-validator.test.ts`

---

## 路线图

项目后续可以重点完善以下方向：

- 更完整的前端交互界面
- 更稳定的 AI 辅助生成策略
- 更丰富的模板与示例电路
- 更强的校验与自动修复流程
- 预览、历史记录与任务管理能力
- 更完善的 CI/CD 与发布流程
- 更完整的 API 文档
- 公共演示环境部署说明

---

## 贡献指南

欢迎贡献。

如果你希望参与贡献，建议按照以下流程进行：

1. Fork 仓库
2. 创建功能分支
3. 保持改动聚焦且清晰
4. 在本地运行 lint、format、type-check 与 test
5. 提交带有清晰说明的 Pull Request

### 提交前建议本地执行

```sh
bun run lint
bun run format:check
bun run type-check
bun run test
```

### 当前特别欢迎的贡献方向

- 前端体验优化
- API 文档补充
- 测试覆盖增强
- 校验/导出流程鲁棒性提升
- pipeline 可观测性建设
- 示例电路与模板扩展

---

## 许可证

本项目使用 [MIT License](./LICENSE)。

这意味着你可以：

- 商业使用
- 修改代码
- 分发代码
- 私人使用

你需要保留原始版权声明和许可证文本。

如需查看完整许可证内容，请参考仓库根目录下的 `LICENSE` 文件。