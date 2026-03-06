/**
 * KiCad 文件类型定义
 */

/**
 * KiCad 工程文件集合
 */
export type KicadFiles = {
  sch: string    // 原理图文件 (.kicad_sch)
  pcb: string    // PCB文件 (.kicad_pcb)
  pro?: string   // 工程文件 (.kicad_pro)
}

/**
 * KiCad 验证结果
 */
export type KicadValidationResult = {
  erc: ErcResult
  drc: DrcResult
}

/**
 * ERC (电气规则检查) 结果
 */
export type ErcResult = {
  exitCode: number
  report: string
  errors: ErcError[]
  warnings: ErcError[]
}

/**
 * ERC 错误
 */
export type ErcError = {
  type: string
  message: string
  location?: {
    file: string
    line?: number
  }
}

/**
 * DRC (设计规则检查) 结果
 */
export type DrcResult = {
  exitCode: number
  report: string
  errors: DrcError[]
  warnings: DrcError[]
}

/**
 * DRC 错误
 */
export type DrcError = {
  type: string
  message: string
  location?: {
    x: string
    y: string
    layer?: string
  }
}

/**
 * Gerber 文件集合
 */
export type GerberFiles = {
  [layer: string]: string  // 例如: { "F.Cu": "...", "B.Cu": "..." }
}

/**
 * BOM (物料清单) 条目
 */
export type BomEntry = {
  designator: string
  footprint: string
  value: string
  quantity: number
  [props: string]: unknown
}

/**
 * KiBot 输出结果
 */
export type KiBotOutput = {
  gerbers?: GerberFiles
  bom?: BomEntry[]
  drill?: string
  reports?: string[]
}

/**
 * 后处理选项
 */
export type PostProcessOptions = {
  runErc?: boolean
  runDrc?: boolean
  generateGerber?: boolean
  generateBom?: boolean
  generateDrill?: boolean
}
