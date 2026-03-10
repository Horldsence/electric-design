# src/types/

## OVERVIEW
TypeScript type definitions for the entire pipeline - tscircuit circuit elements, KiCad file structures, AI errors, and pipeline data.

## STRUCTURE

```
tscircuit.ts      # Circuit JSON element types
kicad.ts          # KiCad .sch/.pcb file structures
ai.ts             # AI generation error types
pipeline.ts       # Pipeline orchestration types (deprecated - use ai.ts)
errors.ts         # Enhanced compilation error types
index.ts          # Type exports barrel file
```

## WHERE TO LOOK

**Circuit elements**: `tscircuit.ts` - `AnyCircuitElement` union type

**KiCad structures**: `kicad.ts` - `KicadPcb`, `KicadSch` interfaces

**AI errors**: `ai.ts` - `AIGenerationResult` with success/error properties

**Enhanced errors**: `errors.ts` - `EnhancedCompilationError` with location/context

## CONVENTIONS

**Zod integration**: Types map 1:1 with Zod schemas for runtime validation

**Type unions**: Use discriminated unions for error types (`type`, `messageType` fields)

**Source imports**: Import types from library packages (`@tscircuit/core`, `circuit-json`)

**Barrel exports**: Re-export via `index.ts` for clean imports

## ANTI-PATTERNS

**Any types**: Never use `any` - use proper union types or `unknown`

**Duplicate types**: Check if library already exports the type before defining

**Missing exports**: Forgetting to add new types to `index.ts`

**Loose validation**: Types should be stricter than runtime schemas (fail fast)
