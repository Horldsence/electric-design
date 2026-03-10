import {
  CircuitJsonToKicadPcbConverter,
  CircuitJsonToKicadSchConverter,
} from 'circuit-json-to-kicad'
import type { KicadFiles } from '../../types/kicad'

export function convertToKiCad(circuitJson: unknown[]): KicadFiles {
  // Type assertion needed because circuit-json and circuit-json-to-kicad have different CircuitJson types
  const pcbConverter = new CircuitJsonToKicadPcbConverter(circuitJson as any)
  pcbConverter.runUntilFinished()
  const pcb = pcbConverter.getOutputString()

  const schConverter = new CircuitJsonToKicadSchConverter(circuitJson as any)
  schConverter.runUntilFinished()
  const sch = schConverter.getOutputString()

  return { pcb, sch }
}
