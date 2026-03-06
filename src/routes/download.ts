import { compilerService } from '../services/tscircuit/compiler'
import { convertToKiCad } from '../services/kicad/converter'
import { generateGerber, generateBom } from '../services/kicad/validator'

/**
 * POST /api/download-kicad
 * Download KiCad PCB file from circuit code
 */
export async function downloadKiCad(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { code, circuitJson } = body

    let circuit = circuitJson

    // If circuitJson not provided, compile the code first
    if (!circuit && code) {
      const sessionId = `download_${Date.now()}`
      const result = await compilerService.compile(sessionId, code)
      circuit = result.circuitJson
      compilerService.cleanup(sessionId)
    }

    if (!circuit || !Array.isArray(circuit)) {
      return Response.json(
        { error: 'Circuit JSON is required' },
        { status: 400 }
      )
    }

    // Convert to KiCad
    const kicadFiles = convertToKiCad(circuit)

    // Return KiCad PCB file as downloadable
    return new Response(kicadFiles.pcb, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="design.kicad_pcb"',
      },
    })
  } catch (error) {
    return Response.json(
      {
        error: 'Failed to generate KiCad file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/download-schematic
 * Download KiCad schematic file from circuit code
 */
export async function downloadSchematic(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { code, circuitJson } = body

    let circuit = circuitJson

    if (!circuit && code) {
      const sessionId = `download_${Date.now()}`
      const result = await compilerService.compile(sessionId, code)
      circuit = result.circuitJson
      compilerService.cleanup(sessionId)
    }

    if (!circuit || !Array.isArray(circuit)) {
      return Response.json(
        { error: 'Circuit JSON is required' },
        { status: 400 }
      )
    }

    const kicadFiles = convertToKiCad(circuit)

    return new Response(kicadFiles.sch, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="design.kicad_sch"',
      },
    })
  } catch (error) {
    return Response.json(
      {
        error: 'Failed to generate schematic file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/download-gerbers
 * Download Gerber files as ZIP from circuit code
 */
export async function downloadGerbers(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { code, circuitJson } = body

    let circuit = circuitJson

    if (!circuit && code) {
      const sessionId = `download_${Date.now()}`
      const result = await compilerService.compile(sessionId, code)
      circuit = result.circuitJson
      compilerService.cleanup(sessionId)
    }

    if (!circuit || !Array.isArray(circuit)) {
      return Response.json(
        { error: 'Circuit JSON is required' },
        { status: 400 }
      )
    }

    // Convert to KiCad
    const kicadFiles = convertToKiCad(circuit)

    // Generate Gerber files
    const sessionId = `gerber_${Date.now()}`
    const gerbers = await generateGerber(kicadFiles.pcb, sessionId)

    // Create a simple archive format (concatenated files with headers)
    let archiveContent = ''
    const layerNames = Object.keys(gerbers)

    for (const layerName of layerNames) {
      archiveContent += `\n\n========== FILE: ${layerName} ==========\n\n`
      archiveContent += gerbers[layerName]
    }

    // Return as text file with all gerbers
    return new Response(archiveContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="gerbers_all.txt"',
      },
    })
  } catch (error) {
    return Response.json(
      {
        error: 'Failed to generate Gerber files',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/download-bom
 * Download BOM as CSV from circuit code
 */
export async function downloadBomFile(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const { code, circuitJson } = body

    let circuit = circuitJson

    if (!circuit && code) {
      const sessionId = `download_${Date.now()}`
      const result = await compilerService.compile(sessionId, code)
      circuit = result.circuitJson
      compilerService.cleanup(sessionId)
    }

    if (!circuit || !Array.isArray(circuit)) {
      return Response.json(
        { error: 'Circuit JSON is required' },
        { status: 400 }
      )
    }

    // Convert to KiCad
    const kicadFiles = convertToKiCad(circuit)

    // Generate BOM
    const sessionId = `bom_${Date.now()}`
    const bom = await generateBom(kicadFiles.sch, sessionId)

    // Convert to CSV
    let csv = 'Designator,Value,Footprint,Quantity\n'
    for (const item of bom) {
      const ref = (item.designator || '').toString().replace(/,/g, ';')
      const val = (item.value || '').toString().replace(/,/g, ';')
      const fp = (item.footprint || '').toString().replace(/,/g, ';')
      const qty = item.quantity || 1
      csv += `${ref},${val},${fp},${qty}\n`
    }

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="bom.csv"',
      },
    })
  } catch (error) {
    return Response.json(
      {
        error: 'Failed to generate BOM',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}