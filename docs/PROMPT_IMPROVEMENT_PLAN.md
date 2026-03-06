# AI Prompt增强方案

## 问题
AI生成的电路代码经常创建组件但不连接它们。

## 根本原因
1. Prompt缺少明确的连接完整性验证指令
2. 缺少"所有引脚必须连接"的硬性要求
3. 测试示例中有未连接的组件，误导AI学习

## 建议的Prompt改进

### 1. 在SYSTEM_PROMPT中添加

```typescript
const SYSTEM_PROMPT = `You are an expert electronic circuit designer specializing in tscircuit.

Your role is to convert natural language circuit descriptions into valid, production-ready tscircuit code.

Critical Connection Rules:
- EVERY component pin MUST be connected via <trace> - no floating pins allowed
- Power connections MUST use net.VCC and net.GND
- Signal connections use component pin references (.ComponentName > .pinName)
- Before returning code, verify: all pins connected, no open circuits

Key principles:
- Write clean, idiomatic TypeScript/JSX code
- Follow tscircuit component conventions
- Always specify footprints for components
- Use proper power net naming (net.VCC, net.GND)
- Connect ALL components with traces (no unconnected components)
- Return ONLY code, no explanations or markdown formatting`
```

### 2. 在BASE_USER_PROMPT中添加验证步骤

```typescript
const BASE_USER_PROMPT = `Create a tscircuit circuit based on this requirement: {prompt}

Requirements:
- Use tscircuit JSX syntax with <board>, <resistor>, <led>, <chip>, <capacitor>, <trace>
- All components must have name and footprint attributes
- Connect ALL components with <trace> elements
- Use power nets: net.VCC, net.GND
- Specify realistic component values (resistance, capacitance, etc.)
- Return ONLY the code, no explanation or markdown blocks

CONNECTION COMPLETENESS CHECKLIST (must pass before returning code):
✓ Every component has at least one trace connection
✓ Every pin is connected to either another component or power net
✓ No floating/unconnected pins
✓ Power nets (VCC/GND) are properly used
✓ Circuit forms complete paths (no dead ends)

Example output format:
export default () => (
  <board width="30mm" height="20mm">
    <resistor name="R1" resistance="1k" footprint="0402" />
    <led name="LED1" footprint="0603" />
    <trace from=".R1 > .pin1" to="net.VCC" />
    <trace from=".R1 > .pin2" to=".LED1 > .pos" />
    <trace from=".LED1 > .neg" to="net.GND" />
  </board>
)`
```

### 3. 在ERROR_RECOVERY_PROMPT中强调连接

```typescript
const ERROR_RECOVERY_PROMPT = `The previous tscircuit code you generated failed to compile with the following errors:

{errors}

Your task:
1. Analyze the compilation errors carefully
2. Fix the issues in the code
3. CRITICAL: Ensure ALL components are properly connected with traces
4. Verify no floating pins exist
5. Return ONLY the corrected code, no explanations

Common issues to check:
- Missing imports or incorrect syntax
- Undefined component references
- Incorrect trace syntax
- Missing required attributes (name, footprint)
- Invalid component types
- UNCONNECTED COMPONENTS - every pin must have a trace!

Correct the code:`
```

### 4. 添加一个新的完整示例

在EXAMPLES数组中添加带验证的示例：

```typescript
const EXAMPLES: PromptConfig['examples'] = [
  // ... 现有示例

  {
    description: 'Voltage regulator circuit with all connections verified',
    prompt: 'Create a 5V voltage regulator circuit with input and output capacitors',
    code: `export default () => (
  <board width="40mm" height="30mm">
    <chip name="U1" footprint="sot223" pinLabels={{
      pin1: "IN", pin2: "GND", pin3: "OUT"
    }} />
    <capacitor name="C1" capacitance="10uF" footprint="0805" />
    <capacitor name="C2" capacitance="10uF" footprint="0805" />

    {/* Input side */}
    <trace from="net.VCC" to=".C1 > .pin1" />
    <trace from=".C1 > .pin2" to=".U1 > .pin1" />

    {/* Ground connections */}
    <trace from=".U1 > .pin2" to="net.GND" />
    <trace from=".C1 > .pin1" to="net.GND" />
    <trace from=".C2 > .pin1" to="net.GND" />

    {/* Output side */}
    <trace from=".U1 > .pin3" to=".C2 > .pin2" />
  </board>
)`,
  },
]
```

### 5. 在CONSTRAINTS中添加

```typescript
const CONSTRAINTS: string[] = [
  'Code must be valid TypeScript/JSX syntax',
  'Must export default function returning JSX',
  'All components require name and footprint attributes',
  'ALL COMPONENT PINS MUST BE CONNECTED - no floating pins allowed',
  'All connections must use traces with proper syntax',
  'Power connections must use net.VCC and net.GND',
  'Return only code, no markdown code blocks or explanations',
  'Use realistic component values and standard footprints',
  'Verify connection completeness before returning code',
]
```

## 实施步骤

1. ✅ 立即修改prompts.ts（高优先级）
2. ⚠️ 修复tests/examples/中的未连接示例
3. 📊 添加编译后验证（在validator.ts中检查未连接的组件）
4. 🧪 更新集成测试以验证连接完整性

## 预期效果

- AI生成的代码将包含完整的trace连接
- 不再出现悬空组件
- 电路逻辑完整性提升
