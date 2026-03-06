import {
  CircuitJsonToKicadPcbConverter,
  CircuitJsonToKicadSchConverter,
} from 'circuit-json-to-kicad'
import type { KicadFiles } from '../../types/kicad'

export function convertToKiCad(circuitJson: unknown[]): KicadFiles {
  const pcbConverter = new CircuitJsonToKicadPcbConverter(circuitJson)
  pcbConverter.runUntilFinished()
  const pcb = pcbConverter.getOutputString()

  const schConverter = new CircuitJsonToKicadSchConverter(circuitJson)
  schConverter.runUntilFinished()
  const sch = schConverter.getOutputString()

  return { pcb, sch }
}
