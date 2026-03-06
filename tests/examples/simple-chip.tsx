export default () => (
  <board width="30mm" height="20mm">
    <chip
      name="U1"
      footprint="soic4"
      schX={0}
      schY={0}
      pinLabels={{
        pin1: "IN",
        pin2: "OUT",
        pin3: "EN",
        pin4: "GND"
      }}
    />
    <resistor
      name="R1"
      resistance="10k"
      footprint="0402"
      schX={-3}
      schY={1}
    />
    <capacitor
      name="C1"
      capacitance="1uF"
      footprint="0402"
      schX={-3}
      schY={-1}
    />
  </board>
)
