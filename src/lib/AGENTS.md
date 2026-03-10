# src/lib/

## OVERVIEW
Core utilities, configuration, and infrastructure - logging, file I/O, WebSocket management, debugging tools, and source code utilities.

## STRUCTURE

```
config.ts           # Environment configuration loader
logger.ts           # Structured logging system (JSON)
file-manager.ts     # File I/O operations
socket-manager.ts   # WebSocket connection management
debug.ts            # Pipeline-specific debug logging
source-utils.ts     # Source code parsing utilities
```

## WHERE TO LOOK

**Configuration entry**: `config.ts` line 9 - `getConfig()` loads env vars with defaults

**Logging core**: `logger.ts` line 5 - `logger` singleton with info/warn/error methods

**Pipeline logger**: `debug.ts` line 1 - `createPipelineLogger(domain, sessionId)` factory

**File operations**: `file-manager.ts` line 7 - `saveKiCadFiles()` writes .sch/.pcb to disk

**WebSocket**: `socket-manager.ts` line 4 - `broadcast()` sends messages to all clients

**Source parsing**: `source-utils.ts` line 1 - `getLine()`, `getSurroundingLines()` utilities

## CONVENTIONS

**Singleton pattern**: All modules export singletons (e.g., `export const logger = ...`)

**Context propagation**: Pass `sessionId` through pipeline for traceable logs

**Structured logging**: All logs are JSON objects with `{ level, timestamp, context, message, data? }`

**Error handling**: File operations return success indicators, don't throw

**Pure functions**: `source-utils.ts` functions are pure (no side effects)

## ANTI-PATTERNS

**Console.log**: Never use `console.log()` - always use `logger` methods

**Complex logging**: Don't use winston/pino/over-engineered logging libraries

**Empty catch blocks**: File operations should log errors even if handled gracefully

**Tight coupling**: Logger should be usable independently of other modules
