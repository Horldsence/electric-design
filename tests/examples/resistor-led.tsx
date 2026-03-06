export default () => (
  <board width="30mm" height="20mm">
    <resistor
      name="R1"
      resistance="1k"
      footprint="0402"
      schX={-2}
      schY={0}
    />
    <led
      name="LED1"
      footprint="0603"
      schX={2}
      schY={0}
    />
    <trace
      from=".R1 > .pin1"
      to=".LED1 > .pos"
    />
  </board>
)
