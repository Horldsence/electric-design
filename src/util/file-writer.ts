import { mkdir } from 'node:fs/promises'

export async function saveKicadFiles(
  name: string,
  kicadFiles: { pcb: string; sch: string },
  outputDir = 'tests/output/kicad',
): Promise<{ pcbPath: string; schPath: string }> {
  await mkdir(outputDir, { recursive: true })

  const pcbPath = `${outputDir}/${name}.kicad_pcb`
  const schPath = `${outputDir}/${name}.kicad_sch`

  await Bun.write(pcbPath, kicadFiles.pcb)
  await Bun.write(schPath, kicadFiles.sch)

  return { pcbPath, schPath }
}
