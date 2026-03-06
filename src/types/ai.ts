/**
 * AI 服务类型定义
 */

/**
 * AI 代码生成结果
 */
export type AIGenerationResult = {
  code: string
  success: boolean
  retryCount: number
  fallback: boolean
}

/**
 * AI 生成错误
 */
export type AIGenerationError = {
  message: string
  type: 'api_error' | 'rate_limit' | 'invalid_response'
  retryable: boolean
}

/**
 * Prompt 模板配置
 */
export type PromptConfig = {
  systemPrompt: string
  userPromptTemplate: string
  examples: PromptExample[]
  constraints: string[]
}

/**
 * Prompt 示例
 */
export type PromptExample = {
  description: string
  prompt: string
  code: string
}

/**
 * AI 提供商类型
 */
export type AIProvider = 'openai' | 'anthropic'

/**
 * AI 配置
 */
export type AIConfig = {
  provider: AIProvider
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

/**
 * 生成选项
 */
export type GenerationOptions = {
  maxRetries?: number
  timeout?: number
  useFallback?: boolean
}
