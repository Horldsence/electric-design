export class AIGenerationError extends Error {
  constructor(
    message: string,
    public retryCount: number
  ) {
    super(message)
    this.name = "AIGenerationError"
  }
}

export class CompilationError extends Error {
  constructor(
    message: string,
    public code: string,
    public logs?: unknown[]
  ) {
    super(message)
    this.name = "CompilationError"
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ type: string; message: string }>
  ) {
    super(message)
    this.name = "ValidationError"
  }
}

export class ConversionError extends Error {
  constructor(
    message: string,
    public stage: string
  ) {
    super(message)
    this.name = "ConversionError"
  }
}
