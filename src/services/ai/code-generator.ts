import { createPipelineLogger } from "../../lib/debug"
import type { AIGenerationResult, PromptConfig } from "../../types/ai"

const FALLBACK_CODE = `
export default () => (
  <board width="30mm" height="20mm">
    <resistor name="R1" resistance="1k" footprint="0402" />
    <led name="LED1" footprint="0603" />
    <trace from=".R1 > .pin1" to="net.VCC" />
    <trace from=".R1 > .pin2" to=".LED1 > .pos" />
    <trace from=".LED1 > .neg" to="net.GND" />
  </board>
)
`

const PROMPT_CONFIG: PromptConfig = {
  systemPrompt: "You are an expert electronic circuit designer specializing in tscircuit.",
  userPromptTemplate: `Create a tscircuit circuit based on this requirement: {prompt}

Requirements:
- Use tscircuit JSX syntax with <board>, <resistor>, <led>, <chip>, <trace>
- All components must have name and footprint attributes
- Connect components with <trace> elements
- Use power nets: net.VCC, net.GND
- Return ONLY the code, no explanation`,
  examples: [],
  constraints: [
    "Code must be valid TypeScript/JSX",
    "All components require footprints",
    "All connections must use traces",
    "Return only code, no markdown blocks"
  ]
}

export async function generateCode(
  userPrompt: string,
  maxRetries = 3
): AIGenerationResult {
  const log = createPipelineLogger("ai-generation", `gen_${Date.now()}`)
  const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    log.warn("No API key found, using fallback code")
    return {
      code: FALLBACK_CODE,
      success: true,
      retryCount: 0,
      fallback: true
    }
  }

  log.info("Starting AI code generation", { promptLength: userPrompt.length, maxRetries })

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const code = await callLLM(userPrompt, apiKey)
      const cleaned = extractCode(code)

      if (isValidTscircuitCode(cleaned)) {
        log.info("Successfully generated code", { attempt, codeLength: cleaned.length })
        return {
          code: cleaned,
          success: true,
          retryCount: attempt
        }
      }

      log.debug("Generated code invalid, retrying", { attempt })
    } catch (error) {
      log.error("LLM call failed", error)
      if (attempt === maxRetries - 1) {
        log.warn("All retries exhausted, using fallback")
        return {
          code: FALLBACK_CODE,
          success: true,
          retryCount: maxRetries,
          fallback: true
        }
      }
    }
  }

  log.warn("Failed to generate valid code, using fallback")
  return {
    code: FALLBACK_CODE,
    success: true,
    retryCount: maxRetries,
    fallback: true
  }
}

async function callLLM(prompt: string, apiKey: string): string {
  const isOpenAI = apiKey.startsWith("sk-")

  if (isOpenAI) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: PROMPT_CONFIG.systemPrompt },
          { role: "user", content: PROMPT_CONFIG.userPromptTemplate.replace("{prompt}", prompt) }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  } else {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `${PROMPT_CONFIG.systemPrompt}\n\n${PROMPT_CONFIG.userPromptTemplate.replace("{prompt}", prompt)}`
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`)
    }

    const data = await response.json()
    return data.content[0].text
  }
}

function extractCode(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:tsx|typescript)?\n([\s\S]+?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  return raw.trim()
}

function isValidTscircuitCode(code: string): boolean {
  return code.includes("<board") &&
         code.includes("export default") &&
         code.includes(">")
}
