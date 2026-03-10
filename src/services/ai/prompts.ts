/**
 * Prompt templates for AI code generation
 */

import type { PromptConfig } from '../../types/ai'
import type { CompilationError } from '../../types/errors'

/**
 * System prompt - defines the AI's role and expertise
 */
const SYSTEM_PROMPT = `You are an expert electronic circuit designer specializing in tscircuit.

Your role is to convert natural language circuit descriptions into valid, production-ready tscircuit code.

Critical Connection Rules:
- EVERY component pin MUST be connected via <trace> - no floating pins allowed
- Count pins: resistors/capacitors=2, LEDs=2, chips=count(pinLabels)
- Verify: total_pins = sum of all component pins, all must have traces
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

/**
 * Base user prompt template
 */
const BASE_USER_PROMPT = `Create a tscircuit circuit based on this requirement: {prompt}

Requirements:
- Use tscircuit JSX syntax with <board>, <resistor>, <led>, <chip>, <capacitor>, <trace>
- All components must have name and footprint attributes
- Connect ALL components with <trace> elements
- Use power nets: net.VCC, net.GND
- Specify realistic component values (resistance, capacitance, etc.)
- CRITICAL: chip pinLabels must use OBJECT format, not array: pinLabels={{ pin1: "VCC", pin2: "GND" }}
- CRITICAL: when referencing chip pins in traces, use the LABEL name, not pin number: .U1 > .VCC (not .U1 > .pin1)
- Return ONLY the code, no explanation or markdown blocks

CONNECTION COMPLETENESS CHECKLIST (must pass before returning code):
✓ Every component has at least one trace connection
✓ EVERY pin on EVERY component must be connected (resistors/capacitors have 2 pins, LEDs have 2 pins)
✓ No floating/unconnected pins - verify by counting: component_pins × 2 = traces_needed
✓ Power nets (VCC/GND) are properly used
✓ Circuit forms complete paths (no dead ends)

PIN CONNECTION RULES:
- Resistor/Capacitor: pin1 AND pin2 must both have traces
- LED: pos AND neg must both have traces
- Chip: ALL pins (pin1, pin2, pin3...) must have traces
- Use explicit connections: <trace from=".Component > .pinX" to="..." />

Example output format:
export default () => (
  <board width="30mm" height="20mm">
    <resistor name="R1" resistance="1k" footprint="0402" />
    <led name="LED1" footprint="0603" />

    {/* ALL pins must be connected - R1 has 2 pins, LED1 has 2 pins */}
    <trace from=".R1 > .pin1" to="net.VCC" />
    <trace from=".R1 > .pin2" to=".LED1 > .pos" />
    <trace from=".LED1 > .neg" to="net.GND" />

    {/* Verification: 3 traces connecting 4 pin endpoints (2 components × 2 pins each) */}
  </board>
)`

/**
 * Error recovery prompt template
 */
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
- CRITICAL: chip pinLabels format - MUST be object {{ pin1: "VCC" }} NOT array ["VCC"]
- CRITICAL: chip pin references - MUST use label name .U1 > .VCC NOT .U1 > .pin1
- Missing required attributes (name, footprint)
- Invalid component types
- UNCONNECTED COMPONENTS - verify ALL pins have traces

Correct the code:`

/**
 * Few-shot examples for better code generation
 */
const EXAMPLES: PromptConfig['examples'] = [
  {
    description: 'Simple LED circuit with current limiting resistor',
    prompt: 'Create a blinking LED circuit with a 555 timer',
    code: `export default () => (
  <board width="50mm" height="30mm">
    <chip name="U1" footprint="soic8" pinLabels={{
      pin1: "GND", pin2: "TRIG", pin3: "OUT",
      pin4: "RESET", pin5: "CV", pin6: "THR",
      pin7: "DIS", pin8: "VCC"
    }} />
    <resistor name="R1" resistance="10k" footprint="0402" />
    <resistor name="R2" resistance="1k" footprint="0402" />
    <led name="LED1" footprint="0603" />
    <capacitor name="C1" capacitance="10uF" footprint="0603" />

    {/* Chip power - use LABEL names from pinLabels, not pin numbers */}
    <trace from=".U1 > .VCC" to="net.VCC" />
    <trace from=".U1 > .GND" to="net.GND" />
    <trace from=".R1 > .pin1" to="net.VCC" />
    <trace from=".R1 > .pin2" to=".U1 > .DIS" />
    <trace from=".LED1 > .pos" to=".U1 > .OUT" />
    <trace from=".LED1 > .neg" to=".R2 > .pin2" />
    <trace from=".R2 > .pin1" to="net.GND" />
    <trace from=".C1 > .pin1" to="net.GND" />
    <trace from=".C1 > .pin2" to=".U1 > .CV" />

    {/* Total: 9 traces for complete connectivity */}
  </board>
)`,
  },
  {
    description: 'RC filter circuit',
    prompt: 'Create a simple RC low-pass filter',
    code: `export default () => (
  <board width="20mm" height="15mm">
    <resistor name="R1" resistance="1k" footprint="0402" />
    <capacitor name="C1" capacitance="100nF" footprint="0402" />
    <trace from=".R1 > .pin1" to="net.VCC" />
    <trace from=".R1 > .pin2" to=".C1 > .pin1" />
    <trace from=".C1 > .pin2" to="net.GND" />
  </board>
)`,
  },
  {
    description: 'Voltage regulator with all connections verified',
    prompt: 'Create a 5V voltage regulator circuit with input and output capacitors',
    code: `export default () => (
  <board width="40mm" height="30mm">
    <chip name="U1" footprint="sot223" pinLabels={{
      pin1: "IN", pin2: "GND", pin3: "OUT"
    }} />
    <capacitor name="C1" capacitance="10uF" footprint="0805" />
    <capacitor name="C2" capacitance="10uF" footprint="0805" />

    {/* Input filtering */}
    <trace from="net.VCC" to=".C1 > .pos" />
    <trace from=".C1 > .pos" to=".U1 > .pin1" />

    {/* Ground connections - all grounded pins connected together */}
    <trace from=".U1 > .pin2" to="net.GND" />
    <trace from=".C1 > .neg" to="net.GND" />
    <trace from=".C2 > .neg" to="net.GND" />

    {/* Output filtering */}
    <trace from=".U1 > .pin3" to=".C2 > .pos" />
  </board>
)`,
  },
]

/**
 * Code generation constraints
 */
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

/**
 * Main prompt configuration
 */
export const PROMPT_CONFIG: PromptConfig = {
  systemPrompt: SYSTEM_PROMPT,
  userPromptTemplate: BASE_USER_PROMPT,
  examples: EXAMPLES,
  constraints: CONSTRAINTS,
}

/**
 * Get error recovery prompt
 */
export function getErrorRecoveryPrompt(errors: string[]): string {
  const errorText = errors.map((e, i) => `${i + 1}. ${e}`).join('\n')
  return ERROR_RECOVERY_PROMPT.replace('{errors}', errorText)
}

/**
 * Get base user prompt with requirement
 */
export function getBaseUserPrompt(requirement: string): string {
  return BASE_USER_PROMPT.replace('{prompt}', requirement)
}

export function getEnhancedErrorRecoveryPrompt(
  sourceCode: string,
  errors: CompilationError[],
): string {
  const priority: Record<string, number> = { syntax: 3, circuit: 2, runtime: 1 }
  const sortedErrors = [...errors].sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0))
  const topErrors = sortedErrors.slice(0, 3)

  let errorText = ''

  topErrors.forEach((error, index) => {
    errorText += `\n## Error ${index + 1}: ${error.type.toUpperCase()}\n\n`

    if (error.message) {
      errorText += `**Message**: ${error.message}\n\n`
    }

    if (error.location) {
      errorText += '**Location**: '
      if (error.location.line) {
        errorText += `Line ${error.location.line}`
      }
      if (error.location.column) {
        errorText += `, Column ${error.location.column}`
      }
      if (error.location.sourceFile) {
        errorText += ` in \`${error.location.sourceFile}\``
      }
      errorText += '\n\n'
    }

    if (error.context?.sourceLine) {
      errorText += '**Error in code**:\n```tsx\n'
      if (error.location?.line) {
        errorText += `> ${error.location.line} | ${error.context.sourceLine}\n`
      } else {
        errorText += `${error.context.sourceLine}\n`
      }
      errorText += '```\n\n'
    }

    if (error.context?.surroundingLines) {
      const { before, after } = error.context.surroundingLines
      const startLine = error.location?.line ? error.location.line - before.length : 1

      errorText += '**Context**:\n```tsx\n'
      before.forEach((line: string, idx: number) => {
        errorText += `  ${startLine + idx} | ${line}\n`
      })

      if (error.location?.line && error.context.sourceLine) {
        errorText += `> ${error.location.line} | ${error.context.sourceLine}\n`
      }

      after.forEach((line: string, idx: number) => {
        const errorLine = error.location?.line ?? 1
        errorText += `  ${errorLine + 1 + idx} | ${line}\n`
      })
      errorText += '```\n\n'
    }
  })

  return `${ERROR_RECOVERY_PROMPT.split('{errors}')[0]}${errorText}\n\n**Current Code**:\n\`\`\`tsx\n${sourceCode}\n\`\`\`\n\n**Your Task**: Generate the corrected code that fixes these errors. Return ONLY the complete corrected code, no explanations.`
}
