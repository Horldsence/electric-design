/**
 * Prompt templates for AI code generation
 */

import type { PromptConfig } from '../../types/ai'

/**
 * System prompt - defines the AI's role and expertise
 */
const SYSTEM_PROMPT = `You are an expert electronic circuit designer specializing in tscircuit.

Your role is to convert natural language circuit descriptions into valid, production-ready tscircuit code.

Key principles:
- Write clean, idiomatic TypeScript/JSX code
- Follow tscircuit component conventions
- Always specify footprints for components
- Use proper power net naming (net.VCC, net.GND)
- Connect all components with traces
- Return ONLY code, no explanations or markdown formatting`

/**
 * Base user prompt template
 */
const BASE_USER_PROMPT = `Create a tscircuit circuit based on this requirement: {prompt}

Requirements:
- Use tscircuit JSX syntax with <board>, <resistor>, <led>, <chip>, <capacitor>, <trace>
- All components must have name and footprint attributes
- Connect components with <trace> elements
- Use power nets: net.VCC, net.GND
- Specify realistic component values (resistance, capacitance, etc.)
- Return ONLY the code, no explanation or markdown blocks

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

/**
 * Error recovery prompt template
 */
const ERROR_RECOVERY_PROMPT = `The previous tscircuit code you generated failed to compile with the following errors:

{errors}

Your task:
1. Analyze the compilation errors carefully
2. Fix the issues in the code
3. Ensure all components are properly connected
4. Return ONLY the corrected code, no explanations

Common issues to check:
- Missing imports or incorrect syntax
- Undefined component references
- Incorrect trace syntax
- Missing required attributes (name, footprint)
- Invalid component types

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
    <trace from=".U1 > .pin8" to="net.VCC" />
    <trace from=".U1 > .pin1" to="net.GND" />
    <trace from=".R1 > .pin1" to="net.VCC" />
    <trace from=".R1 > .pin2" to=".U1 > .pin7" />
    <trace from=".LED1 > .pos" to=".U1 > .pin3" />
    <trace from=".LED1 > .neg" to=".R2 > .pin2" />
    <trace from=".R2 > .pin1" to="net.GND" />
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
]

/**
 * Code generation constraints
 */
const CONSTRAINTS: string[] = [
  'Code must be valid TypeScript/JSX syntax',
  'Must export default function returning JSX',
  'All components require name and footprint attributes',
  'All connections must use traces with proper syntax',
  'Power connections must use net.VCC and net.GND',
  'Return only code, no markdown code blocks or explanations',
  'Use realistic component values and standard footprints',
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
