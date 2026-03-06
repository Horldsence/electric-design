import { getAIConfig } from '../../lib/config'
import { createPipelineLogger } from '../../lib/debug'
import type { AIGenerationResult } from '../../types/ai'
import { compilerService } from '../tscircuit/compiler'
import { PROMPT_CONFIG, getBaseUserPrompt, getErrorRecoveryPrompt } from './prompts'

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

const MAX_TOTAL_ATTEMPTS = 5
const MAX_INITIAL_ATTEMPTS = 2

export async function generateCode(userPrompt: string): AIGenerationResult {
  const log = createPipelineLogger('ai-generation', `gen_${Date.now()}`)
  const aiConfig = getAIConfig()

  if (!aiConfig.apiKey) {
    log.warn('No API key found, using fallback code')
    return {
      code: FALLBACK_CODE,
      success: true,
      retryCount: 0,
      fallback: true,
    }
  }

  log.info('Starting AI code generation with self-healing', { promptLength: userPrompt.length })

  let currentPrompt = userPrompt
  let attemptCount = 0
  let isRecoveryMode = false

  while (attemptCount < MAX_TOTAL_ATTEMPTS) {
    attemptCount++
    const attemptType = isRecoveryMode ? 'recovery' : 'initial'

    try {
      const promptToSend = isRecoveryMode
        ? getErrorRecoveryPrompt(currentPrompt.split('\n'))
        : getBaseUserPrompt(currentPrompt)

      const code = await callLLM(promptToSend, isRecoveryMode)
      const cleaned = extractCode(code)

      if (!isValidTscircuitCode(cleaned)) {
        log.debug('Generated code invalid, retrying', { attempt: attemptCount, type: attemptType })
        if (attemptCount >= MAX_INITIAL_ATTEMPTS && !isRecoveryMode) {
          isRecoveryMode = true
          currentPrompt = userPrompt
        }
        continue
      }

      const sessionId = `validate_${Date.now()}`
      const compileResult = await compilerService.compile(sessionId, cleaned)
      compilerService.cleanup(sessionId)

      if (compileResult.errors && compileResult.errors.length > 0) {
        const errorMessages = compileResult.errors.map(e => e.message)
        log.warn('Compilation failed, entering recovery mode', {
          attempt: attemptCount,
          errors: errorMessages,
        })

        if (!isRecoveryMode) {
          isRecoveryMode = true
        }

        currentPrompt = errorMessages.join('\n')
        continue
      }

      log.info('Successfully generated and validated code', {
        attempt: attemptCount,
        type: attemptType,
        codeLength: cleaned.length,
      })

      return {
        code: cleaned,
        success: true,
        retryCount: attemptCount - 1,
        fallback: false,
      }
    } catch (error) {
      log.error('Generation attempt failed', error, { attempt: attemptCount, type: attemptType })

      if (attemptCount >= MAX_TOTAL_ATTEMPTS) {
        log.warn('All attempts exhausted, using fallback')
        return {
          code: FALLBACK_CODE,
          success: true,
          retryCount: attemptCount,
          fallback: true,
        }
      }
    }
  }

  log.warn('Failed to generate valid code, using fallback')
  return {
    code: FALLBACK_CODE,
    success: true,
    retryCount: attemptCount,
    fallback: true,
  }
}

async function callLLM(prompt: string, isRecovery = false): string {
  const aiConfig = getAIConfig()
  const temperature = isRecovery ? aiConfig.temperature * 0.5 : aiConfig.temperature
  const baseUrl =
    aiConfig.baseUrl ||
    (aiConfig.provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1')

  if (aiConfig.provider === 'openai') {
    const url = `${baseUrl}/chat/completions`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          { role: 'system', content: PROMPT_CONFIG.systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: aiConfig.maxTokens,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  const url = `${baseUrl}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': aiConfig.apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: aiConfig.model,
      max_tokens: aiConfig.maxTokens,
      system: PROMPT_CONFIG.systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.content[0].text
}

function extractCode(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:tsx|typescript)?\n([\s\S]+?)```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim()
  }
  return raw.trim()
}

function isValidTscircuitCode(code: string): boolean {
  return code.includes('<board') && code.includes('export default') && code.includes('>')
}
