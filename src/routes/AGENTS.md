# src/routes/

## OVERVIEW
HTTP API layer - POST endpoints wrapping service calls with input validation.

## WHERE TO LOOK
- `export.ts` - Full pipeline (prompt → KiCad files)
- `compile.ts` - tscircuit code → Circuit JSON
- `convert.ts` - Circuit JSON → KiCad files
- `compile-and-convert.ts` - Compile + convert combined

## CONVENTIONS
- POST handlers only
- Validate input at route layer (check type, required fields)
- Import business logic from `src/services/`
- Response shape: `{ success: boolean, data?, error?: { type, message, details } }`
- 400 for validation failures, 500 for service errors

## ANTI-PATTERNS
**DRY violation**: Response object construction duplicated 4+ times across files. Extract to shared response builder (`src/lib/response.ts`).

**Fat routes**: No business logic in handlers. Keep routes as thin wrappers around services.

**Response shape drift**: Don't invent new response formats. Use existing `{ success, data, error }` pattern.
