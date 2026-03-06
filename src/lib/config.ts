/**
 * 环境配置管理
 *
 * 从环境变量读取所有配置，提供类型安全的访问接口。
 * 使用单例模式确保配置只加载一次。
 */

type EnvConfig = {
  // AI 配置
  ai: {
    provider: 'openai' | 'anthropic'
    apiKey: string
    baseUrl?: string
    model: string
    temperature: number
    maxTokens: number
    timeout: number
  }

  // 服务器配置
  server: {
    port: number
    host: string
    nodeEnv: 'development' | 'production'
  }

  // 日志配置
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
  }

  // Pipeline 配置
  pipeline: {
    maxRetries: number
    compilationTimeout: number
  }
}

/**
 * 获取AI提供商（从API密钥前缀或环境变量）
 */
function getAIProvider(): 'openai' | 'anthropic' {
  const provider = process.env.AI_PROVIDER?.toLowerCase()
  if (provider === 'openai' || provider === 'anthropic') {
    return provider
  }

  const apiKey = process.env.API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return 'openai'
  }

  // Anthropic 密钥以 sk-ant- 开头，检查优先
  if (apiKey.startsWith('sk-ant-')) {
    return 'anthropic'
  }

  // OpenAI 密钥以 sk- 开头
  if (apiKey.startsWith('sk-')) {
    return 'openai'
  }

  return 'openai'
}

/**
 * 加载并验证配置
 */
function loadConfig(): EnvConfig {
  const apiKey = process.env.API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    console.warn('[WARN] No API key found in environment. AI features will use fallback mode.')
  }

  const provider = getAIProvider()
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    ai: {
      provider,
      apiKey: apiKey || '',
      baseUrl: process.env.BASE_URL || process.env.AI_BASE_URL,
      model: process.env.AI_MODEL || (provider === 'openai' ? 'gpt-4' : 'claude-3-sonnet-20240229'),
      temperature: Number(process.env.AI_TEMPERATURE ?? '0.7'),
      maxTokens: Number(process.env.AI_MAX_TOKENS ?? '2000'),
      timeout: Number(process.env.AI_TIMEOUT ?? '30000'),
    },

    server: {
      port: Number(process.env.PORT ?? '3000'),
      host: process.env.HOST ?? '0.0.0.0',
      nodeEnv: isProduction ? 'production' : 'development',
    },

    logging: {
      level:
        (process.env.LOG_LEVEL as EnvConfig['logging']['level']) ||
        (isProduction ? 'info' : 'debug'),
    },

    pipeline: {
      maxRetries: Number(process.env.MAX_RETRIES ?? '5'),
      compilationTimeout: Number(process.env.COMPILATION_TIMEOUT ?? '10000'),
    },
  }
}

/**
 * 配置单例
 */
let configInstance: EnvConfig | null = null

/**
 * 获取配置实例
 *
 * @throws {Error} 如果缺少必需的环境变量
 */
export function getConfig(): EnvConfig {
  if (!configInstance) {
    configInstance = loadConfig()
  }
  return configInstance
}

/**
 * 重置配置（主要用于测试）
 */
export function resetConfig(): void {
  configInstance = null
}

/**
 * 获取AI配置（便捷方法）
 */
export function getAIConfig() {
  const config = getConfig()
  return config.ai
}

/**
 * 检查是否在开发模式
 */
export function isDevelopment(): boolean {
  return getConfig().server.nodeEnv === 'development'
}

/**
 * 检查是否在生产模式
 */
export function isProduction(): boolean {
  return getConfig().server.nodeEnv === 'production'
}

/**
 * 获取日志级别
 */
export function getLogLevel(): EnvConfig['logging']['level'] {
  return getConfig().logging.level
}
