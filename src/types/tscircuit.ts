import type { CompilationError } from './errors'

export type AnyCircuitElement = {
  type: string
  [key: string]: unknown
}

export type SourceComponent = {
  type: 'source_component'
  ftype: string
  source_component_id: string
  name: string
  [props: string]: unknown
}

export type SchematicComponent = {
  type: 'schematic_component'
  schematic_component_id: string
  source_component_id: string
  center: { x: string; y: string }
  size: { width: string; height: string }
  rotation?: number
}

export type PcbComponent = {
  type: 'pcb_component'
  pcb_component_id: string
  source_component_id: string
  center: { x: string; y: string }
  layer: 'top' | 'bottom'
  rotation?: number
  footprint?: string
}

export type PcbTrace = {
  type: 'pcb_trace'
  pcb_trace_id: string
  source_trace_id: string
  route: Array<{
    route_type: 'wire'
    x: string
    y: string
    width: string
  }>
}

export type SourceTrace = {
  type: 'source_trace'
  source_trace_id: string
  name?: string
  from: { port_id: string }
  to: { port_id: string }
}

export type Port = {
  type: 'port'
  port_id: string
  source_component_id: string
  name: string
}

export type Net = {
  type: 'net'
  name: string
}

export type Board = {
  type: 'board'
  board_id: string
  width: string
  height: string
  outline?: Array<{ x: string; y: string }>
}

export type ValidationResult = {
  isValid: boolean
  errors: ValidationError[]
}

export type ValidationError = {
  type: string
  message: string
  circuit_element_id?: string
  severity: 'error' | 'warning'
}

export type CompilationResult = {
  circuitJson: AnyCircuitElement[]
  logs: unknown[]
  errors?: CompilationError[]
  sourceCode?: string
}
