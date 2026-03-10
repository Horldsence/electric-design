import type { AnyCircuitElement } from 'circuit-json'
// @ts-ignore
import { convertCircuitJsonToPcbSvg, convertCircuitJsonToSchematicSvg } from 'circuit-to-svg'

class SvgCache {
  private cache = new Map<bigint | number, { pcbSvg: string; schematicSvg: string | null }>()
  private maxCacheSize = 50

  getSvgs(
    code: string,
    circuitJson: AnyCircuitElement[],
    log?: { warn: (msg: string, err: any) => void }
  ): { pcbSvg: string; schematicSvg: string | null } {
    const hash = Bun.hash(code)

    if (this.cache.has(hash)) {
      const result = this.cache.get(hash)!
      // LRU behavior: move to end
      this.cache.delete(hash)
      this.cache.set(hash, result)
      return result
    }

    const pcbSvg = convertCircuitJsonToPcbSvg(circuitJson)
    let schematicSvg: string | null = null
    try {
      schematicSvg = convertCircuitJsonToSchematicSvg(circuitJson)
    } catch (error) {
      if (log) {
        log.warn('Failed to generate schematic SVG preview', error)
      } else {
        console.warn('Failed to generate schematic SVG:', error)
      }
    }

    const result = { pcbSvg, schematicSvg }
    this.cache.set(hash, result)

    // Remove oldest entry if exceeding max size
    if (this.cache.size > this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    return result
  }
}

export const svgCache = new SvgCache()