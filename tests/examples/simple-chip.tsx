export default () => (
  <board width="30mm" height="20mm">
    <chip
      name="U1"
      footprint="soic4"
      schX={0}
      schY={0}
      pinLabels={{
        pin1: 'IN',
        pin2: 'OUT',
        pin3: 'EN',
        pin4: 'GND',
      }}
    />
    <resistor name="R1" resistance="10k" footprint="0402" schX={-3} schY={1} />
    <capacitor name="C1" capacitance="1uF" footprint="0402" schX={-3} schY={-1} />

    {/* Input connection */}
    <trace from="net.VCC" to=".R1 > .pos" />
    <trace from=".R1 > .neg" to=".U1 > .pin1" />

    {/* Enable pin connection */}
    <trace from=".U1 > .pin3" to="net.VCC" />

    {/* Ground connections */}
    <trace from=".U1 > .pin4" to="net.GND" />
    <trace from=".C1 > .neg" to="net.GND" />

    {/* Output connection */}
    <trace from=".U1 > .pin2" to=".C1 > .pos" />
  </board>
)
