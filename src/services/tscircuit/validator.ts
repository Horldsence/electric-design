import { runAllChecks } from '@tscircuit/checks'
import type { ValidationError, ValidationResult } from '../../types/tscircuit'

type TscircuitCheckError = {
  error_type?: string
  type?: string
  message: string
  circuit_element_id?: string
}

export async function validateCircuit(circuitJson: unknown[]): Promise<ValidationResult> {
  try {
    const errors = await runAllChecks(circuitJson as TscircuitCheckError[])

    return {
      isValid: errors.length === 0,
      errors: errors.map(
        (e: TscircuitCheckError): ValidationError => ({
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
