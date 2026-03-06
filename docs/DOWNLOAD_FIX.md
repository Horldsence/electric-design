# 下载功能修复说明

## 问题描述

之前的网页下载和预览生成失败，主要错误信息：
```
:3000/api/export:1  Failed to load resource: the server responded with a status of 400 (Bad Request)
Error: Failed to download kicad
```

## 根本原因

1. **API 接口不匹配**：
   - 前端发送：`{ code: generatedCode }`
   - `/api/export` 端点期望：`{ prompt, options }`
   - 导致 400 Bad Request 错误

2. **数据流程不完整**：
   - 前端只保存了 TypeScript 代码
   - 没有保存编译后的 `circuitJson`
   - 下载需要：代码 → circuitJson → KiCad 文件 → Gerber/BOM

3. **复杂的多步转换**：
   - 原始流程需要前端多次调用不同 API
   - 容易出错且效率低

## 解决方案

### 1. 前端改进

**保存 circuitJson**：
```typescript
const [circuitJson, setCircuitJson] = useState<any[] | null>(null)

// 在编译时保存
if (compileData.success && compileData.data) {
  setCircuitJson(compileData.data.circuitJson)
  // ...
}
```

**简化下载逻辑**：
```typescript
const handleDownload = async (type: 'kicad' | 'gerber' | 'bom') => {
  const endpoint = `/api/download-${type === 'kicad' ? 'kicad' : type === 'gerber' ? 'gerbers' : 'bom'}`
  
  const res = await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({ circuitJson }),
  })
  
  const blob = await res.blob()
  // 触发下载...
}
```

### 2. 后端新增统一下载端点

创建 `src/routes/download.ts`，提供四个新端点：

#### `/api/download-kicad` - 下载 KiCad PCB 文件
- 输入：`{ circuitJson }` 或 `{ code }`
- 输出：`design.kicad_pcb` 文件

#### `/api/download-schematic` - 下载原理图文件
- 输入：`{ circuitJson }` 或 `{ code }`
- 输出：`design.kicad_sch` 文件

#### `/api/download-gerbers` - 下载 Gerber 文件
- 输入：`{ circuitJson }` 或 `{ code }`
- 输出：`gerbers_all.txt` 文件（包含所有层）
- 内容格式：
  ```
  ========== FILE: F.Cu.gbr ==========
  (gerber content...)
  
  ========== FILE: B.Cu.gbr ==========
  (gerber content...)
  ```

#### `/api/download-bom` - 下载 BOM CSV 文件
- 输入：`{ circuitJson }` 或 `{ code }`
- 输出：`bom.csv` 文件
- CSV 格式：`Designator,Value,Footprint,Quantity`

### 3. 统一的处理流程

每个下载端点都实现以下流程：

```typescript
1. 接收 circuitJson 或 code
2. 如果只有 code，先编译获取 circuitJson
3. 将 circuitJson 转换为 KiCad 文件
4. 根据类型执行相应操作：
   - kicad: 直接返回 PCB 文件
   - gerber: 调用 generateGerber() 生成 Gerber
   - bom: 调用 generateBom() 生成 BOM
5. 设置正确的 Content-Type 和 Content-Disposition
6. 返回文件内容供浏览器下载
```

## 修改的文件

1. **src/components/ConsoleInterface.tsx**
   - 添加 `circuitJson` 状态
   - 保存编译结果的 circuitJson
   - 简化下载函数逻辑

2. **src/routes/download.ts** (新建)
   - `downloadKiCad()` - KiCad PCB 下载
   - `downloadSchematic()` - 原理图下载
   - `downloadGerbers()` - Gerber 文件下载
   - `downloadBomFile()` - BOM CSV 下载

3. **src/index.ts**
   - 注册新的下载路由

## 使用方法

1. 在界面输入电路描述并点击"GENERATE CIRCUIT"
2. 等待生成完成，查看预览
3. 点击相应按钮下载：
   - **Download KiCad PCB** - 获取 `.kicad_pcb` 文件
   - **Download Gerbers** - 获取所有 Gerber 层文件
   - **Download BOM** - 获取 BOM CSV 文件

## 测试

启动服务器：
```bash
bun --hot src/index.ts
```

访问 http://localhost:3000 测试功能。

## 技术细节

### Content-Disposition Header
```typescript
return new Response(content, {
  headers: {
    'Content-Type': 'text/plain',
    'Content-Disposition': 'attachment; filename="design.kicad_pcb"',
  },
})
```
这会触发浏览器的下载行为。

### 错误处理
所有端点都包含完整的错误处理：
- 验证输入参数
- 捕获编译/转换错误
- 返回详细的错误信息

### 兼容性
支持两种输入方式：
- `{ circuitJson }` - 直接使用已编译的结果（推荐，更快）
- `{ code }` - 从 TypeScript 代码开始（会自动编译）

## 未来改进

1. **Gerber ZIP 文件**：使用 JSZip 将多个 Gerber 文件打包成 `.zip`
2. **批量下载**：一次性下载所有文件（PCB + 原理图 + Gerber + BOM）
3. **下载历史**：保存用户的下载记录
4. **预览优化**：在下载前预览 Gerber 文件

## 相关文件

- `src/components/ConsoleInterface.tsx` - 前端下载逻辑
- `src/routes/download.ts` - 后端下载端点
- `src/routes/compile.ts` - 编译服务
- `src/routes/convert.ts` - KiCad 转换服务
- `src/services/kicad/validator.ts` - Gerber/BOM 生成