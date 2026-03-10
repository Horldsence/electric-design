import { runAllChecks } from '@tscircuit/checks'
import type { ValidationError, ValidationResult } from '../../types/tscircuit'

export async function validateCircuit(circuitJson: unknown[]): Promise<ValidationResult> {
  try {
    const errors = await runAllChecks(circuitJson as any)
    const connectionErrors = detectUnconnectedComponents(circuitJson)
    const allErrors = [...errors, ...connectionErrors]

    return {
      isValid: allErrors.length === 0,
      errors: allErrors.map(
        (e: any): ValidationError => ({
          type: e.error_type || e.type || 'validation_error',
          message: e.message,
          circuit_element_id: e.circuit_element_id,
          severity: 'error',
        }),
      ),
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [
        {
          type: 'validation_error',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          severity: 'error',
        },
      ],
    }
  }
}

/**
 * Detect components that have no trace connections
 */
function detectUnconnectedComponents(circuitJson: unknown[]): any[] {
  const errors: any[] = []

  type CircuitElement = {
    type?: string
  }

  const componentCount = circuitJson.filter(
    (e: unknown) =>
      (e as CircuitElement)?.type === 'source_component' ||
      (e as CircuitElement)?.type?.includes('component'),
  ).length

  const traceCount = circuitJson.filter(
    (e: unknown) => (e as CircuitElement)?.type === 'source_trace',
  ).length

  if (componentCount > 0 && traceCount === 0) {
    errors.push({
      type: 'unconnected_components',
      message: `Circuit has ${componentCount} component(s) but no trace connections. All component pins must be connected with <trace> elements.`,
    })
  }

  return errors
}
