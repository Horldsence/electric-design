import { beforeEach, describe, expect, test } from 'bun:test'
import {
  getAIConfig,
  getConfig,
  getLogLevel,
  isDevelopment,
  isProduction,
  resetConfig,
} from '../../src/lib/config'

describe('Config Module', () => {
  const _originalEnv = { ...process.env }

  beforeEach(() => {
    resetConfig()
    process.env.API_KEY = undefined
    process.env.AI_PROVIDER = undefined
    process.env.AI_MODEL = undefined
    process.env.AI_TEMPERATURE = undefined
    process.env.AI_MAX_TOKENS = undefined
    process.env.BASE_URL = undefined
    process.env.LOG_LEVEL = undefined
  })

  describe('getAIConfig', () => {
    test('should use OpenAI provider when API_KEY starts with sk-', () => {
      process.env.API_KEY = 'sk-test-key'
      const config = getAIConfig()

      expect(config.provider).toBe('openai')
      expect(config.apiKey).toBe('sk-test-key')
    })

    test('should use Anthropic provider when API_KEY starts with sk-ant-', () => {
      process.env.API_KEY = 'sk-ant-test-key'
      const config = getAIConfig()

      expect(config.provider).toBe('anthropic')
      expect(config.apiKey).toBe('sk-ant-test-key')
    })

    test('should respect AI_PROVIDER environment variable', () => {
      process.env.API_KEY = 'any-key'
      process.env.AI_PROVIDER = 'anthropic'
      const config = getAIConfig()

      expect(config.provider).toBe('anthropic')
    })

    test('should use custom baseUrl from BASE_URL', () => {
      process.env.API_KEY = 'sk-test'
      process.env.BASE_URL = 'https://custom.api.com'
      const config = getAIConfig()

      expect(config.baseUrl).toBe('https://custom.api.com')
    })

    test('should use default model when AI_MODEL is not set', () => {
      process.env.API_KEY = 'sk-test'
      const config = getAIConfig()

      expect(config.model).toBe('gpt-4')
    })

    test('should use custom model from AI_MODEL', () => {
      process.env.API_KEY = 'sk-test'
      process.env.AI_MODEL = 'deepseek-chat'
      const config = getAIConfig()

      expect(config.model).toBe('deepseek-chat')
    })

    test('should use default temperature when AI_TEMPERATURE is not set', () => {
      process.env.API_KEY = 'sk-test'
      const config = getAIConfig()

      expect(config.temperature).toBe(0.7)
    })

    test('should use custom temperature from AI_TEMPERATURE', () => {
      process.env.API_KEY = 'sk-test'
      process.env.AI_TEMPERATURE = '0.5'
      const config = getAIConfig()

      expect(config.temperature).toBe(0.5)
    })

    test('should use default maxTokens when AI_MAX_TOKENS is not set', () => {
      process.env.API_KEY = 'sk-test'
      const config = getAIConfig()

      expect(config.maxTokens).toBe(2000)
    })

    test('should use custom maxTokens from AI_MAX_TOKENS', () => {
      process.env.API_KEY = 'sk-test'
      process.env.AI_MAX_TOKENS = '4000'
      const config = getAIConfig()

      expect(config.maxTokens).toBe(4000)
    })
  })

  describe('isDevelopment', () => {
    test('should return true when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development'
      expect(isDevelopment()).toBe(true)
    })

    test('should return false when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production'
      expect(isDevelopment()).toBe(false)
    })
  })

  describe('isProduction', () => {
    test('should return true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production'
      expect(isProduction()).toBe(true)
    })

    test('should return false when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development'
      expect(isProduction()).toBe(false)
    })
  })

  describe('getLogLevel', () => {
    test('should use default log level when LOG_LEVEL is not set', () => {
      process.env.NODE_ENV = 'development'
      resetConfig()
      expect(getLogLevel()).toBe('debug')
    })

    test('should use custom log level from LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'warn'
      resetConfig()
      expect(getLogLevel()).toBe('warn')
    })
  })

  describe('Config Singleton', () => {
    test('should return same config instance on multiple calls', () => {
      const config1 = getConfig()
      const config2 = getConfig()

      expect(config1).toBe(config2)
    })

    test('should reset config after calling resetConfig', () => {
      const config1 = getConfig()
      resetConfig()
      const config2 = getConfig()

      expect(config1).not.toBe(config2)
    })
  })
})
