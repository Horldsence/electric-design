/**
 * tscircuit Circuit JSON 类型定义
 *
 * 基于官方文档: https://docs.tscircuit.com/api-reference/advanced/soup
 */

import type { ZodType } from "zod"

/**
 * Circuit JSON 元素基础类型
 */
export type AnyCircuitElement = {
  type: string
  [key: string]: unknown
}

/**
 * 源组件 - 电路设计的逻辑定义
 */
export type SourceComponent = {
  type: "source_component"
  ftype: string  // 例如: "simple_resistor", "led"
  source_component_id: string
  name: string
  [props: string]: unknown
}

/**
 * 原理图组件 - 原理图中的实例
 */
export type SchematicComponent = {
  type: "schematic_component"
  schematic_component_id: string
  source_component_id: string
  center: { x: string; y: string }
  size: { width: string; height: string }
  rotation?: number
}

/**
 * PCB组件 - PCB上的实例
 */
export type PcbComponent = {
  type: "pcb_component"
  pcb_component_id: string
  source_component_id: string
  center: { x: string; y: string }
  layer: "top" | "bottom"
  rotation?: number
  footprint?: string
}

/**
 * PCB走线 - 铜线路径
 */
export type PcbTrace = {
  type: "pcb_trace"
  pcb_trace_id: string
  source_trace_id: string
  route: Array<{
    route_type: "wire"
    x: string
    y: string
    width: string
  }>
}

/**
 * 源走线 - 逻辑连接
 */
export type SourceTrace = {
  type: "source_trace"
  source_trace_id: string
  name?: string
  from: { port_id: string }
  to: { port_id: string }
}

/**
 * 端口 - 组件的连接点
 */
export type Port = {
  type: "port"
  port_id: string
  source_component_id: string
  name: string
}

/**
 * 网络标签 - 电源和地
 */
export type Net = {
  type: "net"
  name: string  // 例如: "VCC", "GND"
}

/**
 * 电路板定义
 */
export type Board = {
  type: "board"
  board_id: string
  width: string
  height: string
  outline?: Array<{ x: string; y: string }>
}

/**
 * 编译结果
 */
export type CompilationResult = {
  circuitJson: AnyCircuitElement[]
  logs: unknown[]
  errors?: CompilationError[]
}

/**
 * 编译错误
 */
export type CompilationError = {
  type: string
  message: string
  elementId?: string
  line?: number
  column?: number
}

/**
 * 验证结果
 */
export type ValidationResult = {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * 验证错误
 */
export type ValidationError = {
  type: string
  message: string
  circuit_element_id?: string
  severity: "error" | "warning"
}
