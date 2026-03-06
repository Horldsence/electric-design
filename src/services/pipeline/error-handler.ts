export class AIGenerationError extends Error {
  constructor(
    message: string,
    public retryCount: number,
  ) {
    super(message)
    this.name = 'AIGenerationError'
  }
}

export class CompilationError extends Error {
  constructor(
    message: string,
    public code: string,
    public logs?: unknown[],
  ) {
    super(message)
    this.name = 'CompilationError'
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: Array<{ type: string; message: string }>,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ConversionError extends Error {
  constructor(
    message: string,
    public stage: string,
  ) {
    super(message)
    this.name = 'ConversionError'
  }
}

export class KiCadValidationError extends Error {
  constructor(
    message: string,
    public checkType: 'erc' | 'drc',
    public violations: Array<{
      type: string
      description: string
      severity: 'error' | 'warning'
      position?: { x: string; y: string }
      items?: Array<{ kind: string; reference?: string; pad_number?: string; net?: string }>
    }>,
  ) {
    super(message)
    this.name = 'KiCadValidationError'
  }
}
