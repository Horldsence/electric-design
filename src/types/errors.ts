export type CompilationError = {
  type: 'syntax' | 'runtime' | 'circuit' | 'abort'
  messageType: 'javascript_error' | 'circuit_error' | 'abort'
  message: string
  location?: {
    line?: number
    column?: number
    sourceFile?: string
  }
  context?: {
    sourceLine?: string
    surroundingLines?: {
      before: string[]
      after: string[]
    }
  }
  details: {
    stack?: string
    originalError?: unknown
  }
}
