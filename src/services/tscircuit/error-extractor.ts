import type { AnyCircuitElement } from 'circuit-json'
import type { CompilationError } from '../../types/errors'

export function extractErrors(
  error: unknown,
  sourceCode?: string,
  circuitJson?: AnyCircuitElement[],
): CompilationError[] {
  const errors: CompilationError[] = []

  if (error instanceof Error) {
    errors.push(parseJavaScriptError(error, sourceCode))
  }

  if (circuitJson) {
    errors.push(...parseCircuitErrors(circuitJson))
  }

  return errors
}

function parseJavaScriptError(error: Error, sourceCode?: string): CompilationError {
  const originalLine = (error as { originalLine?: number }).originalLine
  const originalColumn = (error as { originalColumn?: number }).originalColumn
  const sourceURL = (error as { sourceURL?: string }).sourceURL

  let sourceContext
  if (sourceCode && originalLine) {
    const lines = sourceCode.split('\n')
    const sourceLine = lines[originalLine - 1]
    sourceContext = {
      sourceLine,
      surroundingLines: {
        before: lines.slice(Math.max(0, originalLine - 3), originalLine - 1),
        after: lines.slice(originalLine, originalLine + 2),
      },
    }
  }

  const message = error.message.toLowerCase()
  const errorType: 'syntax' | 'runtime' =
    message.includes('transforming') ||
    message.includes('unexpected token') ||
    message.includes('syntax') ||
    message.includes('expected')
      ? 'syntax'
      : 'runtime'

  return {
    type: errorType,
    messageType: 'javascript_error',
    message: error.message,
    location: {
      line: originalLine,
      column: originalColumn,
      sourceFile: sourceURL,
    },
    context: sourceContext,
    details: {
      stack: error.stack,
      originalError: error,
    },
  }
}

function parseCircuitErrors(circuitJson: AnyCircuitElement[]): CompilationError[] {
  const errorElements = circuitJson.filter(
    (el: any) => el.type && (el.type.includes('error') || el.type.includes('warning')),
  )

  return errorElements.map((el: any) => ({
    type: 'circuit' as const,
    messageType: 'circuit_error' as const,
    message: el.message,
    location: {
      sourceFile: el.source_component_id,
    },
    details: {
      originalError: el,
    },
  }))
}
