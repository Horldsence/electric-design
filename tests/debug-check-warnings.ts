import { runTscircuitCode } from '@tscircuit/eval'
import type { AnyCircuitElement } from 'circuit-json'

const rcFilterCode = `
export default () => (
  <board width="40mm" height="30mm">
    <resistor name="R1" resistance="1k" footprint="0402" />
    <capacitor name="C1" capacitance="100nF" footprint="0603" />
    <chip
      name="U1"
      footprint="DIP-8"
      pinLabels={["VCC", "IN", "OUT", "GND", "NC", "NC", "NC", "NC"]}
    />
    <led name="LED1" footprint="0603" />

    <trace from=".U1 > .pin1" to="net.VCC" />
    <trace from=".U1 > .pin2" to=".R1 > .pin1" />
    <trace from=".R1 > .pin2" to=".C1 > .pin1" />
    <trace from=".C1 > .pin2" to="net.GND" />
    <trace from=".U1 > .pin3" to=".LED1 > .pos" />
    <trace from=".LED1 > .neg" to="net.GND" />
    <trace from=".U1 > .pin4" to="net.GND" />
    <trace from=".U1 > .pin5" to="net.GND" />
    <trace from=".U1 > .pin6" to="net.GND" />
    <trace from=".U1 > .pin7" to="net.GND" />
    <trace from=".U1 > .pin8" to="net.GND" />
  </board>
)
`

async function checkWarnings() {
  const json = (await runTscircuitCode(rcFilterCode)) as AnyCircuitElement[]

  const warnings = json.filter(e => e.type === 'source_pin_missing_trace_warning')
  const traces = json.filter(e => e.type === 'source_trace')

  console.log('Circuit Elements:', json.length)
  console.log('Traces:', traces.length)
  console.log('Missing Pin Warnings:', warnings.length)

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings found:')
    warnings.forEach(w => console.log('  -', 'message' in w ? w.message : 'Unknown warning'))
  } else {
    console.log('\n✅ No missing pin warnings! All pins are connected.')
  }

  const ports = json.filter(e => e.type === 'source_port')
  console.log('\nTotal Ports:', ports.length)
  console.log(
    'Connected Ports:',
    new Set(
      traces.flatMap(t =>
        'connected_source_port_ids' in t && Array.isArray(t.connected_source_port_ids)
          ? t.connected_source_port_ids
          : [],
      ),
    ).size,
  )
}

checkWarnings().catch(console.error)
