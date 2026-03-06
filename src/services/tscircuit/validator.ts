import { runAllChecks } from "@tscircuit/checks"
import type { ValidationResult } from "../../types/tscircuit"

export async function validateCircuit(circuitJson: unknown[]): Promise<ValidationResult> {
  try {
    const errors = await runAllChecks(circuitJson as any)

    return {
      isValid: errors.length === 0,
      errors: errors.map((e: any) => ({
        type: e.error_type || e.type,
        message: e.message,
        circuit_element_id: e.circuit_element_id,
        severity: "error" as const
      }))
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [{
        type: "validation_error",
        message: error instanceof Error ? error.message : "Unknown validation error",
        severity: "error"
      }]
    }
  }
}
