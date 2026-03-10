# tests/integration/

## OVERVIEW
End-to-end pipeline tests covering the full workflow: AI generation → compilation → KiCad conversion → validation → export.

## STRUCTURE

```
pipeline.test.ts                      # Complete pipeline from prompt to files
full-pipeline-self-healing.test.ts    # AI error recovery workflow
ai-generation.test.ts                 # AI code generation with retries
save-kicad-files.test.ts              # File I/O verification
kicad-validation.test.ts              # KiCad CLI integration
```

## WHERE TO LOOK

**Happy path**: `pipeline.test.ts` line 9 - Full workflow with all stages

**Self-healing**: `full-pipeline-self-healing.test.ts` line 14 - AI retry logic

**File outputs**: `save-kicad-files.test.ts` line 8 - Verifies .sch/.pcb written to disk

**KiCad CLI**: `kicad-validation.test.ts` line 22 - ERC/DRC external command tests

## CONVENTIONS

**Bun test framework**: Uses `bun:test` (not Jest/Vitest)

**Timeouts**: AI-dependent tests use 30-45s timeouts (`test(..., 30000)`)

**Conditional skipping**: `test.skipIf(!kicadInstalled, ...)` for environment-dependent tests

**Lifecycle hooks**: `beforeEach`, `beforeAll` for setup/teardown

**Explicit cleanup**: Call `compilerService.cleanup(sessionId)` after tests

## ANTI-PATTERNS

**Hardcoded paths**: Use `tests/output/` for artifacts, don't write to `src/`

**Ignoring timeouts**: AI tests MUST have >30s timeout or they'll fail

**Silent failures**: Always assert on success/failure, don't assume

**Test leakage**: Clean up temp files and compiler state between tests

**Missing coverage**: Add tests when adding new pipeline stages
