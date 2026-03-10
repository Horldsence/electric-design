/**
 * Source Code Utilities
 *
 * 源代码操作工具函数，用于错误上下文提取和代码修复。
 *
 * 设计原则：
 * - 纯函数，无副作用
 * - 简单直接，避免复杂逻辑
 * - 与现有的 .split('\n') 模式一致
 */

/**
 * 获取指定行的代码
 *
 * @param sourceCode - 源代码字符串
 * @param lineNum - 行号（从 1 开始）
 * @returns 该行的代码，如果行号超出范围则返回空字符串
 *
 * @example
 * ```typescript
 * const code = `line1\nline2\nline3`
 * getLine(code, 2) // "line2"
 * ```
 */
export function getLine(sourceCode: string, lineNum: number): string {
  const lines = sourceCode.split('\n')
  return lines[lineNum - 1] || ''
}

/**
 * 获取指定行的周围代码上下文
 *
 * @param sourceCode - 源代码字符串
 * @param lineNum - 中心行号（从 1 开始）
 * @param contextLines - 上下文行数（前后各多少行），默认 3
 * @returns 前后代码行和当前行
 *
 * @example
 * ```typescript
 * const code = `line1\nline2\nline3\nline4\nline5`
 * getSurroundingLines(code, 3, 1)
 * // { before: ["line2"], current: "line3", after: ["line4"] }
 * ```
 */
export function getSurroundingLines(
  sourceCode: string,
  lineNum: number,
  contextLines = 3,
): { before: string[]; current: string; after: string[] } {
  const lines = sourceCode.split('\n')
  const startBefore = Math.max(0, lineNum - contextLines - 1)
  const endBefore = lineNum - 1
  const startAfter = lineNum
  const endAfter = Math.min(lines.length, lineNum + contextLines)

  return {
    before: lines.slice(startBefore, endBefore),
    current: lines[lineNum - 1] || '',
    after: lines.slice(startAfter, endAfter),
  }
}

/**
 * 提取行范围内的代码
 *
 * @param sourceCode - 源代码字符串
 * @param startLine - 起始行号（从 1 开始，包含）
 * @param endLine - 结束行号（从 1 开始，包含）
 * @returns 指定范围内的代码字符串
 *
 * @example
 * ```typescript
 * const code = `line1\nline2\nline3\nline4\nline5`
 * extractLineRange(code, 2, 4)
 * // "line2\nline3\nline4"
 * ```
 */
export function extractLineRange(sourceCode: string, startLine: number, endLine: number): string {
  const lines = sourceCode.split('\n')
  return lines.slice(startLine - 1, endLine).join('\n')
}

/**
 * 格式化源代码位置（用于错误显示）
 *
 * @param sourceCode - 源代码字符串
 * @param line - 行号
 * @param column - 列号（可选）
 * @returns 格式化的位置字符串
 *
 * @example
 * ```typescript
 * formatSourceLocation(code, 5, 10)
 * // "Line 5, Column 10"
 *
 * formatSourceLocation(code, 5)
 * // "Line 5"
 * ```
 */
export function formatSourceLocation(line: number, column?: number): string {
  let location = `Line ${line}`
  if (column !== undefined) {
    location += `, Column ${column}`
  }
  return location
}

/**
 * 高亮显示错误位置（带行号和指针）
 *
 * @param sourceCode - 源代码字符串
 * @param line - 错误行号
 * @param column - 错误列号（可选）
 * @returns 格式化的错误显示
 *
 * @example
 * ```typescript
 * const code = `line1\nline2\nline3`
 * formatErrorWithHighlight(code, 2, 3)
 * // "  1 | line1
 * // > 2 | line2
 * //      ^   (column 3)
 * //  3 | line3"
 * ```
 */
export function formatErrorWithHighlight(
  sourceCode: string,
  line: number,
  column?: number,
): string {
  const lines = sourceCode.split('\n')
  const errorLine = lines[line - 1] || ''

  let output = ''

  // 前一行
  if (line > 1) {
    output += `  ${line - 1} | ${lines[line - 2]}\n`
  }

  // 错误行（带标记）
  output += `> ${line} | ${errorLine}\n`

  // 指针
  if (column !== undefined && column > 0) {
    output += `  ${' '.repeat(column + String(line).length + 2)}^\n`
  }

  // 后一行
  if (line < lines.length) {
    output += `  ${line + 1} | ${lines[line]}\n`
  }

  return output.trim()
}
