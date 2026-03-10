# src/services/

## OVERVIEW
Core business logic that transforms user prompts into KiCad files through four staged transformations.

## STRUCTURE

```
ai/              # LLM integration
  └─ code-generator.ts    # Dual-provider retry logic with fallback

tscircuit/       # Circuit compilation
  ├─ compiler.ts          # Singleton CompilerService class
  └─ validator.ts         # Thin @tscircuit/checks wrapper

kicad/           # KiCad integration
  ├─ converter.ts         # Synchronous Circuit JSON → KiCad
  └─ validator.ts         # ERC/DRC/Gerber/BOM post-processing

pipeline/        # Orchestration
  ├─ orchestrator.ts      # Main coordinator with staged logging
  └─ error-handler.ts     # Custom error hierarchy
```

## WHERE TO LOOK

**AI generation flow**: `ai/code-generator.ts` line 54. Retry loop with API key-based provider detection (OpenAI vs Anthropic). Falls back to hardcoded LED circuit on all failures.

**Compilation entry**: `tscircuit/compiler.ts` line 6. Singleton pattern with exported `compilerService` instance. Wraps `@tscircuit/eval` and returns Circuit JSON or errors.

**Error extraction**: `tscircuit/error-extractor.ts` (NEW). Extracts enhanced error information from JavaScript exceptions and Circuit JSON error elements. Provides line/column numbers and source context.

**Validation strategy**: `tscircuit/validator.ts` line 4. Pure functional wrapper around `@tscircuit/checks`. Maps raw errors to typed ValidationResult.

**KiCad conversion**: `kicad/converter.ts` line 7. Instantiates converters, calls `runUntilFinished()` synchronously, returns both .sch and .pcb strings.

**Post-processing bottleneck**: `kicad/validator.ts` lines 28-177. All four helper functions duplicate the same pattern. Create temp file, exec CLI command, parse output, cleanup. See ANTI-PATTERNS below.

## CONVENTIONS

**Singleton vs functional**: Compiler and complex stateful services use class singletons (`export const service = new Service()`). Simple transformations use pure functions.

**Context propagation**: Every service creates a logger with `createPipelineLogger(domain, sessionId)`. Passes `sessionId` through the pipeline call chain. Use `log.info()` for state changes, `log.error()` for failures.

**Error shape**: All services return typed result objects with `{ success, data?, errors? }`. Never throw directly. Return errors in the response for the orchestrator to handle.

**Dual-provider pattern**: `code-generator.ts` detects provider by API key prefix. OpenAI keys start with "sk-". Everything else goes to Anthropic.

**CLI integration pattern**: `kicad/validator.ts` wraps `child_process.exec` in try-finally. Always cleanup temp files even when CLI command fails.

**Error enhancement**: When compilation fails, use `TscircuitErrorExtractor.extract()` to get line numbers, column numbers, and source context. Pass this to AI for better error recovery (see docs/ERROR_HANDLING_RESEARCH.md).

## ANTI-PATTERNS

**DRY violation in kicad/validator.ts**: Lines 28-177 contain four functions (`runErc`, `runDrc`, `generateGerber`, `generateBom`) that duplicate the exec() pattern ~120 lines total. Extract to a reusable `execKiCadCLI()` helper that accepts command and temp file path. The only variation is output parsing logic.

**Empty cleanup methods**: `tscircuit/compiler.ts` line 33 has a stub `cleanup()` that does nothing. Remove if unused, or implement CircuitRunner disposal if the library supports it.

**Console.log vs logger**: `code-generator.ts` uses the logger correctly, but ensure all services use `createPipelineLogger` instead of console statements for consistent structured logging.

**Poor error reporting for AI**: When returning errors to the AI code generator, only passing `error.message` loses critical context (line numbers, column numbers, source code context). Use `TscircuitErrorExtractor` to enhance errors before passing to AI. This improves fix success rate from 45-60% to 70-85% (see docs/ERROR_HANDLING_RESEARCH.md).
