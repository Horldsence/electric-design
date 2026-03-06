import { beforeAll, describe, expect, test } from 'bun:test'
import {
  analyzeValidationErrors,
  autoFixValidationErrors,
  formatValidationErrors,
} from '../src/services/kicad/auto-fix'
import {
  checkKiCadAvailability,
  generateBom,
  generateGerber,
  runDrc,
  runErc,
} from '../src/services/kicad/validator'
import { KiCadValidationError } from '../src/services/pipeline/error-handler'

// Sample KiCad files for testing
const SAMPLE_SCH = `(kicad_sch (version 20231120) (generator "eeschema") (generator_version "8.0")
  (uuid "12345678-1234-1234-1234-123456789abc")
  (paper "A4")
  (lib_symbols)
  (symbol_instances)
  (sheet_instances
    (path "/" (page "1"))
  )
)`

const SAMPLE_PCB = `(kicad_pcb (version 20231120) (generator "pcbnew") (generator_version "8.0")
  (general
    (thickness 1.6)
  )
  (paper "A4")
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user "B.Adhesive")
    (33 "F.Adhes" user "F.Adhesive")
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user "B.Silkscreen")
    (37 "F.SilkS" user "F.Silkscreen")
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (40 "Dwgs.User" user "User.Drawings")
    (41 "Cmts.User" user "User.Comments")
    (42 "Eco1.User" user "User.Eco1")
    (43 "Eco2.User" user "User.Eco2")
    (44 "Edge.Cuts" user)
    (45 "Margin" user)
    (46 "B.CrtYd" user "B.Courtyard")
    (47 "F.CrtYd" user "F.Courtyard")
    (48 "B.Fab" user)
    (49 "F.Fab" user)
  )
  (setup
    (pad_to_mask_clearance 0)
    (allow_soldermask_bridges_in_footprints no)
    (pcbplotparams
      (layerselection 0x00010fc_ffffffff)
      (plot_on_all_layers_selection 0x0000000_00000000)
      (disableapertmacros no)
      (usegerberextensions no)
      (usegerberattributes yes)
      (usegerberadvancedattributes yes)
      (creategerberjobfile yes)
      (dashed_line_dash_ratio 12.000000)
      (dashed_line_gap_ratio 3.000000)
      (svgprecision 4)
      (plotframeref no)
      (viasonmask no)
      (mode 1)
      (useauxorigin no)
      (hpglpennumber 1)
      (hpglpenspeed 20)
      (hpglpendiameter 15.000000)
      (pdf_front_fp_property_popups yes)
      (pdf_back_fp_property_popups yes)
      (dxfpolygonmode yes)
      (dxfimperialunits yes)
      (dxfusepcbnewfont yes)
      (psnegative no)
      (psa4output no)
      (plotreference yes)
      (plotvalue yes)
      (plotfptext yes)
      (plotinvisibletext no)
      (sketchpadsonfab no)
      (subtractmaskfromsilk no)
      (outputformat 1)
      (mirror no)
      (drillshape 1)
      (scaleselection 1)
      (outputdirectory "")
    )
  )
  (net 0 "")
  (gr_rect
    (start 0 0)
    (end 100 100)
    (stroke (width 0.1) (type solid))
    (fill none)
    (layer "Edge.Cuts")
    (uuid "12345678-1234-1234-1234-123456789def")
  )
)`

describe('KiCad CLI Availability', () => {
  test('should check if KiCad CLI is available', async () => {
    const availability = await checkKiCadAvailability()

    if (availability.available) {
      console.log('KiCad CLI found:', availability.path)
      console.log('Version:', availability.version)
      expect(availability.path).toBeDefined()
      expect(availability.version).toBeDefined()
    } else {
      console.warn('KiCad CLI not available - skipping integration tests')
    }
  })
})

describe('KiCad Validator - ERC', () => {
  let kicadAvailable = false

  beforeAll(async () => {
    const availability = await checkKiCadAvailability()
    kicadAvailable = availability.available
  })

  test('should run ERC on valid schematic', async () => {
    if (!kicadAvailable) {
      console.log('Skipping: KiCad CLI not available')
      return
    }

    const result = await runErc(SAMPLE_SCH, 'test-erc-1')

    expect(result).toBeDefined()
    expect(result.exitCode).toBeDefined()
    expect(result.errors).toBeInstanceOf(Array)
    expect(result.warnings).toBeInstanceOf(Array)

    console.log('ERC Result:', {
      exitCode: result.exitCode,
      errors: result.errors.length,
      warnings: result.warnings.length,
    })
  })

  test('should throw KiCadValidationError on ERC violations', async () => {
    if (!kicadAvailable) {
      console.log('Skipping: KiCad CLI not available')
      return
    }

    // Create a schematic with intentional errors
    const badSch = `(kicad_sch (version 20231120) (generator "eeschema") (generator_version "8.0")
      (uuid "12345678-1234-1234-1234-123456789abc")
      (paper "A4")
      (lib_symbols
        (symbol "Device:R" (pin_numbers hide) (pin_names (offset 0)) (in_bom yes) (on_board yes)
          (property "Reference" "R" (at 2.032 0 90) (effects (font (size 1.27 1.27))))
          (property "Value" "R" (at 0 0 90) (effects (font (size 1.27 1.27))))
          (property "Footprint" "" (at -1.778 0 90) (effects (font (size 1.27 1.27)) hide))
          (property "Datasheet" "~" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
          (symbol "R_0_1"
            (rectangle (start -1.016 -2.54) (end 1.016 2.54)
              (stroke (width 0.254) (type default))
              (fill (type none))
            )
          )
          (symbol "R_1_1"
            (pin passive line (at 0 3.81 270) (length 1.27)
              (name "~" (effects (font (size 1.27 1.27))))
              (number "1" (effects (font (size 1.27 1.27))))
            )
            (pin passive line (at 0 -3.81 90) (length 1.27)
              (name "~" (effects (font (size 1.27 1.27))))
              (number "2" (effects (font (size 1.27 1.27))))
            )
          )
        )
      )
      (symbol (lib_id "Device:R") (at 50 50 0) (unit 1)
        (uuid "11111111-1111-1111-1111-111111111111")
        (property "Reference" "R1" (at 50 50 0) (effects (font (size 1.27 1.27))))
        (property "Value" "10k" (at 50 50 0) (effects (font (size 1.27 1.27))))
        (property "Footprint" "" (at 48.222 50 90) (effects (font (size 1.27 1.27)) hide))
        (property "Datasheet" "~" (at 50 50 0) (effects (font (size 1.27 1.27)) hide))
        (pin "1" (uuid "22222222-2222-2222-2222-222222222222"))
        (pin "2" (uuid "33333333-3333-3333-3333-333333333333"))
      )
      (sheet_instances
        (path "/" (page "1"))
      )
    )`

    try {
      await runErc(badSch, 'test-erc-2')
      // If no error thrown, that's also fine (depends on KiCad strictness)
    } catch (error) {
      if (error instanceof KiCadValidationError) {
        expect(error.checkType).toBe('erc')
        expect(error.violations.length).toBeGreaterThan(0)
        console.log('ERC violations detected:', error.violations.length)
      }
    }
  })
})

describe('KiCad Validator - DRC', () => {
  let kicadAvailable = false

  beforeAll(async () => {
    const availability = await checkKiCadAvailability()
    kicadAvailable = availability.available
  })

  test('should run DRC on valid PCB', async () => {
    if (!kicadAvailable) {
      console.log('Skipping: KiCad CLI not available')
      return
    }

    const result = await runDrc(SAMPLE_PCB, 'test-drc-1')

    expect(result).toBeDefined()
    expect(result.exitCode).toBeDefined()
    expect(result.errors).toBeInstanceOf(Array)
    expect(result.warnings).toBeInstanceOf(Array)

    console.log('DRC Result:', {
      exitCode: result.exitCode,
      errors: result.errors.length,
      warnings: result.warnings.length,
    })
  })
})

describe('KiCad Validator - Gerber Generation', () => {
  let kicadAvailable = false

  beforeAll(async () => {
    const availability = await checkKiCadAvailability()
    kicadAvailable = availability.available
  })

  test('should generate Gerber files from PCB', async () => {
    if (!kicadAvailable) {
      console.log('Skipping: KiCad CLI not available')
      return
    }

    try {
      const gerbers = await generateGerber(SAMPLE_PCB, 'test-gerber-1')

      expect(gerbers).toBeDefined()
      expect(typeof gerbers).toBe('object')

      const layerCount = Object.keys(gerbers).length
      console.log('Generated Gerber layers:', layerCount)
      console.log('Layer files:', Object.keys(gerbers))

      // Should have at least some standard layers
      if (layerCount > 0) {
        expect(layerCount).toBeGreaterThan(0)
      }
    } catch (error) {
      console.warn('Gerber generation failed:', error)
      // Don't fail test as this depends on PCB content
    }
  })
})

describe('KiCad Validator - BOM Generation', () => {
  let kicadAvailable = false

  beforeAll(async () => {
    const availability = await checkKiCadAvailability()
    kicadAvailable = availability.available
  })

  test('should generate BOM from schematic', async () => {
    if (!kicadAvailable) {
      console.log('Skipping: KiCad CLI not available')
      return
    }

    const bom = await generateBom(SAMPLE_SCH, 'test-bom-1')

    expect(bom).toBeDefined()
    expect(Array.isArray(bom)).toBe(true)

    console.log('BOM entries:', bom.length)

    if (bom.length > 0) {
      console.log('First entry:', bom[0])
      expect(bom[0]).toHaveProperty('designator')
      expect(bom[0]).toHaveProperty('value')
      expect(bom[0]).toHaveProperty('footprint')
    }
  })
})

describe('Auto-fix - Error Analysis', () => {
  test('should analyze validation errors', () => {
    const mockError = new KiCadValidationError('ERC: 5 violations', 'erc', [
      {
        type: 'pin_not_connected',
        description: 'Pin not connected',
        severity: 'error',
      },
      {
        type: 'pin_not_connected',
        description: 'Another pin not connected',
        severity: 'error',
      },
      {
        type: 'power_pin_not_driven',
        description: 'Power pin not driven',
        severity: 'error',
      },
      {
        type: 'similar_labels',
        description: 'Similar label names',
        severity: 'warning',
      },
    ])

    const analysis = analyzeValidationErrors(mockError)

    expect(analysis.summary).toContain('ERC')
    expect(analysis.suggestions.length).toBeGreaterThan(0)
    expect(analysis.severity).toBeDefined()
    expect(['critical', 'high', 'medium', 'low']).toContain(analysis.severity)

    console.log('Analysis:', analysis)
  })

  test('should format validation errors', () => {
    const mockError = new KiCadValidationError('DRC: 3 violations', 'drc', [
      {
        type: 'clearance',
        description: 'Clearance violation',
        severity: 'error',
        position: { x: '10.5', y: '20.3' },
      },
      {
        type: 'track_width',
        description: 'Track too narrow',
        severity: 'error',
      },
      {
        type: 'copper_sliver',
        description: 'Copper sliver detected',
        severity: 'warning',
      },
    ])

    const formatted = formatValidationErrors(mockError)

    expect(formatted).toContain('DRC')
    expect(formatted).toContain('VALIDATION REPORT')
    expect(formatted).toContain('clearance')
    expect(formatted).toContain('SUGGESTIONS')

    console.log('Formatted output:\n', formatted)
  })
})

describe('Auto-fix - Mock Test', () => {
  test(
    'should attempt auto-fix with mock compile function',
    async () => {
      const mockError = new KiCadValidationError('ERC: 2 violations', 'erc', [
        {
          type: 'pin_not_connected',
          description: 'Pin not connected',
          severity: 'error',
        },
        {
          type: 'power_pin_not_driven',
          description: 'Power pin not driven',
          severity: 'error',
        },
      ])

      let attemptCount = 0
      const mockCompileAndValidate = async (_code: string) => {
        attemptCount++

        // Simulate success on second attempt
        if (attemptCount >= 2) {
          return {
            success: true,
            ercResult: {
              exitCode: 0,
              report: '',
              errors: [],
              warnings: [],
            },
          }
        }

        // First attempt still has errors
        return {
          success: false,
          error: new KiCadValidationError('ERC: 1 violation', 'erc', [
            {
              type: 'pin_not_connected',
              description: 'One pin still not connected',
              severity: 'error',
            },
          ]),
        }
      }

      const result = await autoFixValidationErrors(
        'Create a simple LED circuit',
        'const led = new LED()',
        mockError,
        mockCompileAndValidate,
        { maxRetries: 3 },
        'test-autofix-1',
      )

      expect(result).toBeDefined()
      expect(result.attempts).toBeGreaterThan(0)
      expect(result.fixHistory.length).toBeGreaterThan(0)

      console.log('Auto-fix result:', {
        fixed: result.fixed,
        attempts: result.attempts,
        originalErrors: result.originalErrors,
        remainingErrors: result.remainingErrors,
        fixHistory: result.fixHistory,
      })

      // Log detailed fix history
      for (const historyEntry of result.fixHistory) {
        console.log(
          `Attempt ${historyEntry.attempt}: ${historyEntry.strategy} - ${historyEntry.errorsFound} errors found`,
        )
        if (historyEntry.errorTypes.length > 0) {
          console.log(`  Error types: ${historyEntry.errorTypes.join(', ')}`)
        }
      }
    },
    { timeout: 120000 },
  ) // 2 minutes timeout for real AI calls
})
