import { getAIConfig } from '../../lib/config'
import { createPipelineLogger } from '../../lib/debug'
import type { AIGenerationResult } from '../../types/ai'
import { compilerService } from '../tscircuit/compiler'
import {
  PROMPT_CONFIG,
  getBaseUserPrompt,
  getEnhancedErrorRecoveryPrompt,
  getErrorRecoveryPrompt,
} from './prompts'

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

export async function generateCode(userPrompt: string): Promise<AIGenerationResult> {
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
        log.warn('Compilation failed, entering recovery mode', {
          attempt: attemptCount,
          errorCount: compileResult.errors.length,
          errorTypes: compileResult.errors.map(e => e.type),
          errorLocations: compileResult.errors.map(e => e.location?.line ?? 'unknown'),
        })

        if (!isRecoveryMode) {
          isRecoveryMode = true
        }

        const enhancedPrompt = getEnhancedErrorRecoveryPrompt(cleaned, compileResult.errors)

        log.debug('Generated enhanced error recovery prompt', {
          promptLength: enhancedPrompt.length,
          sourceCodeLength: cleaned.length,
          errorCount: compileResult.errors.length,
        })

        currentPrompt = enhancedPrompt
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
      log.error('Generation attempt failed', error)

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

async function callLLM(prompt: string, isRecovery = false): Promise<string> {
  const log = createPipelineLogger('ai-generation', `llm_${Date.now()}`)
  const aiConfig = getAIConfig()
  const temperature = isRecovery ? aiConfig.temperature * 0.5 : aiConfig.temperature
  const baseUrl =
    aiConfig.baseUrl ||
    (aiConfig.provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1')

  log.debug('Calling LLM', {
    provider: aiConfig.provider,
    model: aiConfig.model,
    temperature,
    promptLength: prompt.length,
    isRecovery,
  })

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
      const apiError = new Error(`OpenAI API error: ${response.status} - ${error}`)
      log.error('OpenAI API request failed', apiError)
      throw apiError
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    log.debug('LLM response received', {
      responseLength: content.length,
      finishReason: data.choices[0].finish_reason,
    })

    return content
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
    const apiError = new Error(`Anthropic API error: ${response.status} - ${error}`)
    log.error('Anthropic API request failed', apiError)
    throw apiError
  }

  const data = await response.json()
  const content = data.content[0].text

  log.debug('LLM response received', {
    responseLength: content.length,
    stopReason: data.stop_reason,
  })

  return content
}

function extractCode(raw: string): string {
  const codeBlockMatch = raw.match(/```(?:tsx|typescript)?\n([\s\S]+?)```/)
  return codeBlockMatch?.[1]?.trim() ?? raw.trim()
}

function isValidTscircuitCode(code: string): boolean {
  return code.includes('<board') && code.includes('export default') && code.includes('>')
}
