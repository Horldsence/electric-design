import { runTscircuitCode } from '@tscircuit/eval'
import type { AnyCircuitElement } from 'circuit-json'

async function testConnection() {
  const code = `
export default () => (
  <board width="30mm" height="20mm">
    <resistor name="R1" resistance="1k" footprint="0402" schX={-2} schY={0} />
    <led name="LED1" footprint="0603" schX={2} schY={0} />
    <trace from=".R1 > .pin1" to=".LED1 > .pos" />
  </board>
)
`

  const json = await runTscircuitCode(code)
  console.log('Circuit JSON (', json.length, 'elements):')
  console.log(JSON.stringify(json, null, 2))

  const traces = json.filter((e: AnyCircuitElement) => e.type === 'source_trace')
  console.log('\n\nFound', traces.length, 'traces:')
  traces.forEach((t: AnyCircuitElement) => console.log(JSON.stringify(t, null, 2)))

  const components = json.filter(
    (e: AnyCircuitElement) =>
      e.type === 'source_component' || (typeof e.type === 'string' && e.type.includes('component')),
  )
  console.log('\n\nFound', components.length, 'components:')
  components.forEach((c: AnyCircuitElement) => console.log(JSON.stringify(c, null, 2)))
}

testConnection().catch(console.error)
