import { createPipelineLogger } from '../../lib/debug'
import type { DrcResult, ErcResult } from '../../types/kicad'
import { generateCode } from '../ai/code-generator'
import type { KiCadValidationError } from '../pipeline/error-handler'

/**
 * AI Auto-fix service for KiCad validation errors
 * Attempts to fix ERC/DRC violations by regenerating code with error context
 */

export type AutoFixOptions = {
  maxRetries?: number
  includeWarnings?: boolean
  aggressiveFix?: boolean
}

export type AutoFixResult = {
  fixed: boolean
  attempts: number
  originalErrors: number
  remainingErrors: number
  fixedCode?: string
  fixHistory: Array<{
    attempt: number
    strategy: string
    errorsFound: number
    errorTypes: string[]
  }>
}

/**
 * Generate fix prompt based on validation errors
 */
function generateFixPrompt(
  originalPrompt: string,
  originalCode: string,
  validationError: KiCadValidationError,
  attempt: number,
): string {
  const { checkType, violations } = validationError

  // Group violations by type
  const errorsByType = violations.reduce(
    (acc, v) => {
      const type = v.type
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(v)
      return acc
    },
    {} as Record<string, typeof violations>,
  )

  const errorSummary = Object.entries(errorsByType)
    .map(([type, errors]) => `- ${type}: ${errors.length} occurrence(s)`)
    .join('\n')

  // Detailed error descriptions
  const errorDetails = violations
    .slice(0, 5) // Limit to first 5 errors
    .map((v, i) => {
      let details = `${i + 1}. ${v.type}: ${v.description}`
      if (v.position) {
        details += ` at position (${v.position.x}, ${v.position.y})`
      }
      if (v.items && v.items.length > 0) {
        const itemDesc = v.items
          .map(item => item.reference || item.kind)
          .filter(Boolean)
          .join(', ')
        if (itemDesc) {
          details += ` - affects: ${itemDesc}`
        }
      }
      return details
    })
    .join('\n')

  const moreErrors = violations.length > 5 ? `\n... and ${violations.length - 5} more errors` : ''

  // Strategy based on attempt number
  let strategy = ''
  if (attempt === 1) {
    strategy = `
Please fix the following ${checkType.toUpperCase()} violations in the circuit design.
Focus on the most critical errors first.`
  } else if (attempt === 2) {
    strategy = `
Previous fix attempt did not resolve all issues. 
Try a different approach:
- Simplify the design if necessary
- Check component connections carefully
- Verify power and ground connections
- Ensure proper decoupling`
  } else {
    strategy = `
This is attempt ${attempt}. Previous attempts have not fully resolved the issues.
Consider a more fundamental redesign:
- Simplify the circuit architecture
- Use different components if needed
- Review the basic circuit topology
- Ensure all design rules are followed`
  }

  return `${strategy}

Original user request:
"""
${originalPrompt}
"""

Previous code that failed validation:
"""typescript
${originalCode}
"""

${checkType.toUpperCase()} Validation Errors (${violations.length} total):

${errorSummary}

Detailed Error Information:
${errorDetails}${moreErrors}

Please generate corrected tscircuit code that fixes these ${checkType.toUpperCase()} violations.
Make sure to:
1. Address all the errors listed above
2. Maintain the original circuit functionality
3. Follow KiCad design rules
4. Use proper component placement and routing
5. Include appropriate decoupling capacitors for ICs
6. Ensure power and ground connections are correct

Generate ONLY the corrected tscircuit code, no explanations.`
}

/**
 * Extract error types from validation result
 */
function extractErrorTypes(result: ErcResult | DrcResult): string[] {
  const types = new Set<string>()
  for (const error of result.errors) {
    types.add(error.type)
  }
  return Array.from(types)
}

/**
 * Attempt to auto-fix validation errors using AI
 */
export async function autoFixValidationErrors(
  originalPrompt: string,
  originalCode: string,
  validationError: KiCadValidationError,
  compileAndValidate: (code: string) => Promise<{
    success: boolean
    ercResult?: ErcResult
    drcResult?: DrcResult
    error?: KiCadValidationError
  }>,
  options: AutoFixOptions = {},
  sessionId?: string,
): Promise<AutoFixResult> {
  const log = createPipelineLogger('kicad-autofix', sessionId || 'unknown')
  const maxRetries = options.maxRetries ?? 3
  const _includeWarnings = options.includeWarnings ?? false

  const result: AutoFixResult = {
    fixed: false,
    attempts: 0,
    originalErrors: validationError.violations.filter(v => v.severity === 'error').length,
    remainingErrors: 0,
    fixHistory: [],
  }

  log.info('Starting auto-fix', {
    checkType: validationError.checkType,
    originalErrors: result.originalErrors,
    maxRetries,
  })

  let currentCode = originalCode
  let lastError = validationError

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    result.attempts = attempt

    log.info(`Auto-fix attempt ${attempt}/${maxRetries}`)

    try {
      // Generate fix prompt
      const fixPrompt = generateFixPrompt(originalPrompt, currentCode, lastError, attempt)

      log.debug('Generated fix prompt', { promptLength: fixPrompt.length })

      // Generate new code
      const generationResult = await generateCode(fixPrompt)
      currentCode = generationResult.code

      log.debug('Generated new code', { codeLength: currentCode.length })

      // Validate the new code
      const validationResult = await compileAndValidate(currentCode)

      const checkResult =
        validationError.checkType === 'erc'
          ? validationResult.ercResult
          : validationResult.drcResult

      const errorCount = checkResult?.errors.length || 0
      const errorTypes = checkResult ? extractErrorTypes(checkResult) : []

      result.fixHistory.push({
        attempt,
        strategy:
          attempt === 1
            ? 'direct_fix'
            : attempt === 2
              ? 'alternative_approach'
              : 'fundamental_redesign',
        errorsFound: errorCount,
        errorTypes,
      })

      log.info(`Attempt ${attempt} result`, {
        success: validationResult.success,
        errors: errorCount,
        errorTypes,
      })

      if (validationResult.success) {
        // Success! No more errors
        result.fixed = true
        result.fixedCode = currentCode
        result.remainingErrors = 0

        log.info('✓ Auto-fix successful', {
          attempts: attempt,
          originalErrors: result.originalErrors,
        })

        return result
      }

      if (validationResult.error) {
        lastError = validationResult.error

        // Check if we made progress
        const currentErrors = lastError.violations.filter(v => v.severity === 'error').length

        if (currentErrors < result.originalErrors) {
          log.info('Progress made', {
            originalErrors: result.originalErrors,
            currentErrors,
            reduction: result.originalErrors - currentErrors,
          })
        }

        result.remainingErrors = currentErrors

        // If this is the last attempt, break
        if (attempt === maxRetries) {
          log.warn('Max retries reached', {
            remainingErrors: currentErrors,
            progress: result.originalErrors - currentErrors,
          })
          break
        }
      } else {
        // Some other error occurred
        log.error('Unexpected validation result', validationResult)
        break
      }
    } catch (error) {
      log.error(`Attempt ${attempt} failed with exception`, error)

      result.fixHistory.push({
        attempt,
        strategy: 'failed',
        errorsFound: -1,
        errorTypes: ['exception'],
      })

      // Continue to next attempt
      if (attempt < maxRetries) {
        continue
      }
      break
    }
  }

  if (!result.fixed) {
    log.warn('Auto-fix incomplete', {
      attempts: result.attempts,
      originalErrors: result.originalErrors,
      remainingErrors: result.remainingErrors,
      improvement: result.originalErrors - result.remainingErrors,
    })

    // If we made some progress, include the last code
    if (result.remainingErrors < result.originalErrors) {
      result.fixedCode = currentCode
      log.info('Partial fix available', {
        errorReduction: result.originalErrors - result.remainingErrors,
      })
    }
  }

  return result
}

/**
 * Analyze validation errors and suggest manual fixes
 */
export function analyzeValidationErrors(validationError: KiCadValidationError): {
  summary: string
  suggestions: string[]
  severity: 'critical' | 'high' | 'medium' | 'low'
} {
  const { checkType, violations } = validationError

  // Group by type
  const errorsByType = violations.reduce(
    (acc, v) => {
      const type = v.type
      acc[type] = (acc[type] || 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const errorTypes = Object.keys(errorsByType)
  const totalErrors = violations.filter(v => v.severity === 'error').length
  const totalWarnings = violations.filter(v => v.severity === 'warning').length

  // Determine severity
  let severity: 'critical' | 'high' | 'medium' | 'low' = 'low'
  if (totalErrors > 10) severity = 'critical'
  else if (totalErrors > 5) severity = 'high'
  else if (totalErrors > 0) severity = 'medium'

  // Generate suggestions based on common error types
  const suggestions: string[] = []

  if (checkType === 'erc') {
    if (errorTypes.some(t => t.includes('pin_not_connected') || t.includes('unconnected'))) {
      suggestions.push('Check for unconnected pins - all IC pins should be connected or marked NC')
    }
    if (errorTypes.some(t => t.includes('power') || t.includes('PWR'))) {
      suggestions.push('Verify power connections - ensure all power pins are properly connected')
    }
    if (errorTypes.some(t => t.includes('pin_to_pin') || t.includes('conflict'))) {
      suggestions.push('Fix pin conflicts - check for output-to-output connections')
    }
    if (errorTypes.some(t => t.includes('no_driver') || t.includes('floating'))) {
      suggestions.push('Add drivers for floating nets - ensure all nets have a source')
    }
  } else if (checkType === 'drc') {
    if (errorTypes.some(t => t.includes('clearance') || t.includes('spacing'))) {
      suggestions.push('Increase clearance between traces and components')
    }
    if (errorTypes.some(t => t.includes('track_width') || t.includes('width'))) {
      suggestions.push('Check trace widths - may need wider traces for current capacity')
    }
    if (errorTypes.some(t => t.includes('hole') || t.includes('drill'))) {
      suggestions.push('Verify drill holes and via sizes')
    }
    if (errorTypes.some(t => t.includes('copper') || t.includes('overlap'))) {
      suggestions.push('Fix copper overlaps and collisions')
    }
    if (errorTypes.some(t => t.includes('zone') || t.includes('fill'))) {
      suggestions.push('Check copper zones and fills for violations')
    }
  }

  // Generic suggestions
  if (totalErrors > 5) {
    suggestions.push('Consider simplifying the design to reduce complexity')
  }
  suggestions.push(`Review ${checkType.toUpperCase()} settings in KiCad project`)

  const summary = `${checkType.toUpperCase()} found ${totalErrors} error(s) and ${totalWarnings} warning(s) across ${errorTypes.length} different types`

  return {
    summary,
    suggestions,
    severity,
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(validationError: KiCadValidationError): string {
  const { checkType, violations } = validationError
  const analysis = analyzeValidationErrors(validationError)

  let output = `\n${'='.repeat(60)}\n`
  output += `${checkType.toUpperCase()} VALIDATION REPORT\n`
  output += `${'='.repeat(60)}\n\n`

  output += `${analysis.summary}\n`
  output += `Severity: ${analysis.severity.toUpperCase()}\n\n`

  // Group by severity
  const errors = violations.filter(v => v.severity === 'error')
  const warnings = violations.filter(v => v.severity === 'warning')

  if (errors.length > 0) {
    output += `ERRORS (${errors.length}):\n`
    output += `${'-'.repeat(60)}\n`
    errors.slice(0, 10).forEach((v, i) => {
      output += `${i + 1}. [${v.type}] ${v.description}\n`
      if (v.position) {
        output += `   Position: (${v.position.x}, ${v.position.y})\n`
      }
      if (v.items && v.items.length > 0) {
        const refs = v.items.map(item => item.reference).filter(Boolean)
        if (refs.length > 0) {
          output += `   Affects: ${refs.join(', ')}\n`
        }
      }
      output += '\n'
    })
    if (errors.length > 10) {
      output += `... and ${errors.length - 10} more errors\n\n`
    }
  }

  if (warnings.length > 0) {
    output += `\nWARNINGS (${warnings.length}):\n`
    output += `${'-'.repeat(60)}\n`
    warnings.slice(0, 5).forEach((v, i) => {
      output += `${i + 1}. [${v.type}] ${v.description}\n`
    })
    if (warnings.length > 5) {
      output += `... and ${warnings.length - 5} more warnings\n\n`
    }
  }

  output += '\nSUGGESTIONS:\n'
  output += `${'-'.repeat(60)}\n`
  analysis.suggestions.forEach((s, i) => {
    output += `${i + 1}. ${s}\n`
  })

  output += `\n${'='.repeat(60)}\n`

  return output
}
